#!/usr/bin/env python3
"""Build a deterministic, content-hashed source manifest for an access review."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import stat
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Optional, Sequence


MANIFEST_VERSION = "1.0.0"
MANIFEST_GENERATOR = "tahr-test-access-control/build_review_manifest.py"
BUILT_IN_EXCLUSIONS = (".git",)
MUTABLE_REVISIONS = frozenset(
    {
        "branch",
        "current",
        "dev",
        "develop",
        "development",
        "dirty",
        "head",
        "latest",
        "main",
        "master",
        "tip",
        "trunk",
        "unstaged",
        "working-tree",
        "working_tree",
    }
)
MUTABLE_PREFIXES = (
    "branch:",
    "branch/",
    "heads/",
    "origin/",
    "refs/heads/",
    "refs/remotes/",
    "remotes/",
)
SNAPSHOT_REVISION = re.compile(r"^snapshot-sha256:([0-9a-f]{64})$")
SHA256_REVISION = re.compile(r"^sha256:[0-9a-f]{64}$")
GIT_COMMIT_REVISION = re.compile(r"^(?:git:)?[0-9a-f]{7,64}$", re.IGNORECASE)
VERSIONED_RELEASE = re.compile(r"^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
NUMERIC_REVISION = re.compile(r"^r[1-9][0-9]*$", re.IGNORECASE)
PLAIN_DATE_REVISION = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+Z-]+)?$")
WINDOWS_ABSOLUTE = re.compile(r"^[A-Za-z]:/")


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _normalize_exclusion(raw_value: str) -> str:
    value = raw_value.strip().replace("\\", "/")
    while value.startswith("./"):
        value = value[2:]
    value = value.rstrip("/") or "."
    path = PurePosixPath(value)
    if (
        not raw_value.strip()
        or path.is_absolute()
        or WINDOWS_ABSOLUTE.match(value)
        or ".." in path.parts
        or "\x00" in value
    ):
        raise ValueError(f"excluded path escapes repository root: {raw_value!r}")
    return value


def _matches_exclusion(relative_path: str, patterns: Sequence[str]) -> bool:
    path = PurePosixPath(relative_path)
    for pattern in patterns:
        if pattern == ".":
            return True
        if relative_path == pattern or relative_path.startswith(pattern + "/"):
            return True
        if fnmatch.fnmatchcase(relative_path, pattern) or path.match(pattern):
            return True
    return False


def _validate_revision(raw_revision: str) -> str:
    revision = raw_revision.strip()
    lowered = revision.lower()
    if not revision:
        raise ValueError("revision is required and must identify immutable source")
    if any(character.isspace() or ord(character) < 32 for character in revision):
        raise ValueError("revision must not contain whitespace or control characters")
    if (
        lowered in MUTABLE_REVISIONS
        or lowered.startswith(MUTABLE_PREFIXES)
        or lowered.startswith("head^")
        or lowered.startswith("head~")
        or PLAIN_DATE_REVISION.fullmatch(revision)
    ):
        raise ValueError(f"revision appears mutable or non-content-addressed: {revision}")
    if lowered.startswith("snapshot-sha256:") and not SNAPSHOT_REVISION.fullmatch(lowered):
        raise ValueError("snapshot revision must be snapshot-sha256 followed by 64 lowercase hex characters")
    if lowered.startswith("sha256:") and not SHA256_REVISION.fullmatch(lowered):
        raise ValueError("sha256 revision must contain 64 lowercase hex characters")
    if not any(
        pattern.fullmatch(revision)
        for pattern in (SNAPSHOT_REVISION, SHA256_REVISION, GIT_COMMIT_REVISION, VERSIONED_RELEASE, NUMERIC_REVISION)
    ):
        raise ValueError("revision must be a commit hash, content digest, or explicitly versioned release—not a branch-like label")
    return revision


def _normalize_label(raw_value: str, label: str) -> str:
    value = " ".join(raw_value.split())
    if not value or any(ord(character) < 32 for character in value):
        raise ValueError(f"{label} must be a non-empty printable value")
    return value


def _digest_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
    return size, "sha256:" + digest.hexdigest()


def _output_layout(root: Path, output: Path) -> tuple[Path, Optional[str]]:
    """Return a normalized destination and its deterministic scope exclusion."""
    supplied_destination = Path(os.path.abspath(output.expanduser()))
    destination = supplied_destination.parent.resolve(strict=False) / supplied_destination.name
    if not _is_within(destination, root):
        return destination, None
    if destination.parent == root:
        raise ValueError(
            "manifest output cannot be placed directly in the repository root; "
            "use a dedicated subdirectory such as .tahr-review/repository-manifest.json"
        )
    return destination, _relative(destination.parent, root)


def _string_list(value: Any, *, nonempty: bool = False) -> bool:
    return (
        isinstance(value, list)
        and all(isinstance(item, str) and (item or not nonempty) for item in value)
        and value == sorted(set(value))
    )


def _is_owned_manifest(value: Any) -> bool:
    """Recognize only a self-consistent manifest emitted by this generator."""
    if not isinstance(value, dict) or set(value) != {
        "manifest_version",
        "generator",
        "repository_name",
        "revision",
        "content_hash",
        "included_paths",
        "included_packages",
        "supplied_documents",
        "excluded_paths",
        "files",
    }:
        return False
    if value.get("manifest_version") != MANIFEST_VERSION or value.get("generator") != MANIFEST_GENERATOR:
        return False
    if not isinstance(value.get("repository_name"), str) or not value["repository_name"]:
        return False
    if not _string_list(value.get("included_paths"), nonempty=True):
        return False
    if not _string_list(value.get("included_packages"), nonempty=True):
        return False
    if not _string_list(value.get("supplied_documents"), nonempty=True):
        return False
    if not _string_list(value.get("excluded_paths"), nonempty=True):
        return False
    files = value.get("files")
    if not isinstance(files, list) or not files:
        return False
    previous_path = ""
    for entry in files:
        if not isinstance(entry, dict) or set(entry) != {"path", "type", "size", "sha256"}:
            return False
        path = entry.get("path")
        if (
            not isinstance(path, str)
            or not path
            or path <= previous_path
            or PurePosixPath(path).is_absolute()
            or ".." in PurePosixPath(path).parts
        ):
            return False
        previous_path = path
        if entry.get("type") not in {"file", "symlink_file"}:
            return False
        if isinstance(entry.get("size"), bool) or not isinstance(entry.get("size"), int) or entry["size"] < 0:
            return False
        if not isinstance(entry.get("sha256"), str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", entry["sha256"]):
            return False

    scope_payload = {
        "included_paths": value["included_paths"],
        "included_packages": value["included_packages"],
        "supplied_documents": value["supplied_documents"],
        "excluded_paths": value["excluded_paths"],
        "files": files,
    }
    canonical_scope = json.dumps(
        scope_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    digest = hashlib.sha256(canonical_scope).hexdigest()
    if value.get("content_hash") != "sha256:" + digest:
        return False
    try:
        revision = _validate_revision(value.get("revision", ""))
    except ValueError:
        return False
    snapshot = SNAPSHOT_REVISION.fullmatch(revision.lower())
    return snapshot is None or snapshot.group(1) == digest


def _owned_manifest_digest(path: Path) -> Optional[str]:
    if not os.path.lexists(path):
        return None
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"refusing to replace non-regular or aliased manifest output: {path}")
    raw = path.read_bytes()
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"refusing to overwrite an existing file that is not a Tahr manifest: {path}") from exc
    if not _is_owned_manifest(value):
        raise ValueError(f"refusing to overwrite an existing file not owned by this manifest generator: {path}")
    return hashlib.sha256(raw).hexdigest()


def _file_entry(path: Path, root: Path) -> dict[str, Any]:
    if not _is_within(path, root):
        raise ValueError(f"file path escapes repository root: {path}")

    entry_type = "file"
    content_path = path
    if path.is_symlink():
        try:
            content_path = path.resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            raise ValueError(f"unresolvable symlink in admitted scope: {_relative(path, root)}") from exc
        if not _is_within(content_path, root):
            raise ValueError(f"symlink escapes repository root: {_relative(path, root)}")
        if not content_path.is_file():
            raise ValueError(f"admitted symlink does not resolve to a regular file: {_relative(path, root)}")
        entry_type = "symlink_file"
    elif not stat.S_ISREG(path.stat().st_mode):
        raise ValueError(f"admitted path is not a regular file: {_relative(path, root)}")

    size, digest = _digest_file(content_path)
    return {
        "path": _relative(path, root),
        "type": entry_type,
        "size": size,
        "sha256": digest,
    }


def _resolve_include(root: Path, raw_include: str) -> tuple[Path, str]:
    if not raw_include.strip() or "\x00" in raw_include:
        raise ValueError("included path must not be empty")
    supplied = Path(raw_include).expanduser()
    lexical = supplied if supplied.is_absolute() else root / supplied
    lexical = Path(os.path.abspath(lexical))
    if not _is_within(lexical, root):
        raise ValueError(f"included path escapes repository root: {raw_include}")
    try:
        resolved = lexical.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ValueError(f"included path does not exist: {raw_include}") from exc
    if not _is_within(resolved, root):
        raise ValueError(f"included path resolves outside repository root: {raw_include}")
    if lexical.is_symlink() and resolved.is_dir():
        raise ValueError(f"included directory symlinks are not supported: {raw_include}")
    normalized = "." if lexical == root else _relative(lexical, root)
    if lexical.is_dir() and normalized != ".":
        normalized += "/"
    return lexical, normalized


def _collect_files(
    root: Path,
    includes: Sequence[str],
    exclusions: Sequence[str],
) -> tuple[list[str], list[dict[str, Any]]]:
    normalized_includes: set[str] = set()
    entries: dict[str, dict[str, Any]] = {}

    for raw_include in includes:
        candidate, normalized = _resolve_include(root, raw_include)
        normalized_includes.add(normalized)

        if candidate.is_file() or candidate.is_symlink():
            relative_path = _relative(candidate, root)
            if not _matches_exclusion(relative_path, exclusions):
                entries[relative_path] = _file_entry(candidate, root)
            continue

        if not candidate.is_dir():
            raise ValueError(f"included path is not a file or directory: {raw_include}")

        for current_root, directory_names, file_names in os.walk(candidate, followlinks=False):
            current = Path(current_root)
            kept_directories: list[str] = []
            for name in sorted(directory_names):
                child = current / name
                relative_path = _relative(child, root)
                if _matches_exclusion(relative_path, exclusions):
                    continue
                if child.is_symlink():
                    try:
                        resolved = child.resolve(strict=True)
                    except (OSError, RuntimeError) as exc:
                        raise ValueError(f"unresolvable symlink in admitted scope: {relative_path}") from exc
                    if not _is_within(resolved, root):
                        raise ValueError(f"symlink escapes repository root: {relative_path}")
                    raise ValueError(f"admitted directory symlinks are not supported: {relative_path}")
                kept_directories.append(name)
            directory_names[:] = kept_directories

            for name in sorted(file_names):
                child = current / name
                relative_path = _relative(child, root)
                if not _matches_exclusion(relative_path, exclusions):
                    entries[relative_path] = _file_entry(child, root)

    if not entries:
        raise ValueError("the admitted source scope contains no files")
    return sorted(normalized_includes), [entries[path] for path in sorted(entries)]


def build_manifest(
    root: Path,
    includes: Sequence[str],
    excludes: Sequence[str],
    packages: Sequence[str],
    documents: Sequence[str],
    revision: Optional[str],
    output: Path,
) -> tuple[dict[str, Any], bytes]:
    try:
        resolved_root = root.expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ValueError(f"repository root does not exist: {root}") from exc
    if not resolved_root.is_dir():
        raise ValueError(f"repository root is not a directory: {resolved_root}")

    requested_exclusions = {_normalize_exclusion(value) for value in excludes}
    effective_exclusions = set(BUILT_IN_EXCLUSIONS) | requested_exclusions

    _, output_directory_exclusion = _output_layout(resolved_root, output)
    if output_directory_exclusion is not None:
        effective_exclusions.add(output_directory_exclusion)

    normalized_exclusions = sorted(effective_exclusions)
    normalized_packages = sorted({_normalize_label(value, "package") for value in packages})
    normalized_documents: list[str] = []
    for value in documents:
        document_path, normalized = _resolve_include(resolved_root, value)
        if not (document_path.is_file() or document_path.is_symlink()):
            raise ValueError(f"supplied document must be a file: {value}")
        normalized_documents.append(normalized)
    normalized_documents = sorted(set(normalized_documents))
    normalized_includes, files = _collect_files(
        resolved_root,
        tuple(includes or (".",)) + tuple(normalized_documents),
        normalized_exclusions,
    )
    admitted_file_paths = {str(entry["path"]) for entry in files}
    excluded_documents = sorted(set(normalized_documents) - admitted_file_paths)
    if excluded_documents:
        raise ValueError("supplied documents were excluded from admitted source: " + ", ".join(excluded_documents))

    scope_payload = {
        "included_paths": normalized_includes,
        "included_packages": normalized_packages,
        "supplied_documents": normalized_documents,
        "excluded_paths": normalized_exclusions,
        "files": files,
    }
    canonical_scope = json.dumps(
        scope_payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    content_digest = hashlib.sha256(canonical_scope).hexdigest()
    content_hash = "sha256:" + content_digest

    bound_revision = _validate_revision(revision) if revision is not None else "snapshot-sha256:" + content_digest

    snapshot_match = SNAPSHOT_REVISION.fullmatch(bound_revision.lower())
    if snapshot_match and snapshot_match.group(1) != content_digest:
        raise ValueError("snapshot revision digest does not match the admitted source manifest")

    manifest = {
        "manifest_version": MANIFEST_VERSION,
        "generator": MANIFEST_GENERATOR,
        "repository_name": resolved_root.name,
        "revision": bound_revision,
        "content_hash": content_hash,
        **scope_payload,
    }
    output_bytes = (
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    return manifest, output_bytes


def _write_atomic(path: Path, content: bytes, expected_existing_digest: Optional[str]) -> None:
    destination = path.expanduser()
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=destination.name + ".",
        suffix=".tmp",
        dir=destination.parent,
    )
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if _owned_manifest_digest(destination) != expected_existing_digest:
            raise ValueError("manifest output changed after safety inspection; refusing to replace it")
        os.replace(temporary_name, destination)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="repository root to inventory")
    parser.add_argument(
        "--include",
        action="append",
        default=[],
        help="repository-relative file or directory to admit; repeat as needed (default: .)",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="repository-relative path or glob to exclude; repeat as needed",
    )
    parser.add_argument(
        "--package",
        action="append",
        default=[],
        help="included package or module label; repeat as needed",
    )
    parser.add_argument(
        "--document",
        action="append",
        default=[],
        help="repository-relative supplied policy/design document; repeat as needed and it is admitted automatically",
    )
    parser.add_argument(
        "--revision",
        help="immutable commit or release digest; omit to derive snapshot-sha256 from admitted content",
    )
    parser.add_argument("--output", required=True, type=Path, help="manifest JSON output path")
    args = parser.parse_args(argv)

    try:
        resolved_root = args.root.expanduser().resolve(strict=True)
        destination, _ = _output_layout(resolved_root, args.output)
        expected_existing_digest = _owned_manifest_digest(destination)
        manifest, output_bytes = build_manifest(
            args.root,
            args.include or ["."],
            args.exclude,
            args.package,
            args.document,
            args.revision,
            destination,
        )
        _write_atomic(destination, output_bytes, expected_existing_digest)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1

    print(f"revision={manifest['revision']}")
    print(f"content_hash={manifest['content_hash']}")
    print(f"files={len(manifest['files'])}")
    print(f"output={destination.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
