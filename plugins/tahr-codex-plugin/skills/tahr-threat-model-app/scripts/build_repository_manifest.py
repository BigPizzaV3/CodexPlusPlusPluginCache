#!/usr/bin/env python3
"""Build a deterministic, content-hashed manifest for a full threat-model review."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Optional, Sequence


BUILT_IN_EXCLUSIONS = (".git",)


def _within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _matches_exclusion(relative_path: str, patterns: Sequence[str]) -> bool:
    path = PurePosixPath(relative_path)
    for raw_pattern in patterns:
        pattern = raw_pattern.strip().replace("\\", "/").rstrip("/")
        if not pattern:
            continue
        if relative_path == pattern or relative_path.startswith(pattern + "/"):
            return True
        if fnmatch.fnmatchcase(relative_path, pattern) or path.match(pattern):
            return True
    return False


def _file_digest(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
    return size, digest.hexdigest()


def _entry(path: Path, root: Path) -> dict[str, Any]:
    relative_path = _relative(path, root)
    if path.is_symlink():
        target = os.readlink(path)
        encoded = target.encode("utf-8", errors="surrogateescape")
        return {
            "path": relative_path,
            "type": "symlink",
            "size": len(encoded),
            "sha256": hashlib.sha256(encoded).hexdigest(),
            "target": target,
        }
    size, digest = _file_digest(path)
    return {"path": relative_path, "type": "file", "size": size, "sha256": digest}


def build_manifest(
    root: Path,
    includes: Sequence[str],
    excludes: Sequence[str],
    output: Path,
    revision: Optional[str],
) -> tuple[dict[str, Any], bytes]:
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError(f"repository root is not a directory: {root}")

    output_resolved = output.resolve(strict=False)
    effective_exclusions = list(BUILT_IN_EXCLUSIONS) + list(excludes)
    generated_output: Optional[str] = None
    if _within(output_resolved, root):
        generated_output = (
            _relative(output_resolved.parent, root)
            if output_resolved.parent != root
            else _relative(output_resolved, root)
        )
        effective_exclusions.append(generated_output)

    normalized_includes: list[str] = []
    entries: dict[str, dict[str, Any]] = {}
    for raw_include in includes:
        candidate = Path(os.path.abspath(root / raw_include))
        if not _within(candidate, root):
            raise ValueError(f"included path escapes repository root: {raw_include}")
        if not candidate.exists() and not candidate.is_symlink():
            raise ValueError(f"included path does not exist: {raw_include}")
        relative_include = _relative(candidate, root) if candidate != root else "."
        if candidate.is_dir() and relative_include != ".":
            relative_include += "/"
        if relative_include not in normalized_includes:
            normalized_includes.append(relative_include)

        if candidate.is_file() or candidate.is_symlink():
            relative_path = _relative(candidate, root)
            if not _matches_exclusion(relative_path, effective_exclusions):
                entries[relative_path] = _entry(candidate, root)
            continue

        for current_root, directory_names, file_names in os.walk(candidate, followlinks=False):
            current = Path(current_root)
            kept_directories: list[str] = []
            for name in sorted(directory_names):
                child = current / name
                relative_path = _relative(child, root)
                if _matches_exclusion(relative_path, effective_exclusions):
                    continue
                if child.is_symlink():
                    entries[relative_path] = _entry(child, root)
                else:
                    kept_directories.append(name)
            directory_names[:] = kept_directories
            for name in sorted(file_names):
                child = current / name
                relative_path = _relative(child, root)
                if not _matches_exclusion(relative_path, effective_exclusions):
                    entries[relative_path] = _entry(child, root)

    if not entries:
        raise ValueError("the admitted inventory contains no files or symlinks")

    normalized_includes.sort()
    normalized_excludes = sorted({item.replace("\\", "/").rstrip("/") for item in excludes if item.strip()})
    sorted_entries = [entries[key] for key in sorted(entries)]
    scope_payload = {
        "included_paths": normalized_includes,
        "excluded_patterns": normalized_excludes,
        "built_in_exclusions": list(BUILT_IN_EXCLUSIONS),
        "generated_output_exclusion": generated_output,
        "entries": sorted_entries,
    }
    scope_bytes = json.dumps(scope_payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    content_hash = "sha256:" + hashlib.sha256(scope_bytes).hexdigest()
    bound_revision = revision or "snapshot-" + content_hash
    manifest = {
        "manifest_version": "1.0.0",
        "repository_name": root.name,
        "revision": bound_revision,
        # Hash the canonical admitted scope payload rather than the serialized
        # manifest, which cannot safely contain a hash of itself.
        "content_hash": content_hash,
        **scope_payload,
    }
    output_bytes = (json.dumps(manifest, sort_keys=True, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    return manifest, output_bytes


def _write_atomic(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="repository root to inventory")
    parser.add_argument("--include", action="append", default=[], help="admitted repository-relative file or directory; repeat as needed (default: .)")
    parser.add_argument("--exclude", action="append", default=[], help="repository-relative path or glob to exclude; repeat as needed")
    parser.add_argument("--revision", help="immutable VCS/release revision; omit to derive snapshot-sha256 from admitted content")
    parser.add_argument("--output", required=True, type=Path, help="manifest JSON output path")
    args = parser.parse_args(argv)
    try:
        manifest, content = build_manifest(args.root, args.include or ["."], args.exclude, args.output, args.revision)
        _write_atomic(args.output, content)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"revision={manifest['revision']}")
    print(f"content_hash={manifest['content_hash']}")
    print(f"entries={len(manifest['entries'])}")
    print(f"output={args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
