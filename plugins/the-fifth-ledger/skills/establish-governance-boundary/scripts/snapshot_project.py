#!/usr/bin/env python3
"""Create a deterministic, no-explicit-write observation of a non-Git tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

SCHEMA = "fifth-ledger.snapshot.v1"
ALGORITHM = "sha256-tree-v1"
METADATA_ALGORITHM = "sha256-posix-metadata-v1"
DIGEST_RE = re.compile(r"^[0-9a-f]{64}$")
WINDOWS_DRIVE_PREFIX_RE = re.compile(r"^[A-Za-z]:")


class SnapshotError(RuntimeError):
    """The target could not produce two matching traversal observations."""


def timestamp() -> str:
    """Return a second-precision UTC observation timestamp."""
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stat_identity(entry_stat: os.stat_result) -> tuple[int, ...]:
    """Return all represented metadata plus object-identity fields."""
    return (
        entry_stat.st_dev,
        entry_stat.st_ino,
        entry_stat.st_mode,
        getattr(entry_stat, "st_uid", -1),
        getattr(entry_stat, "st_gid", -1),
        entry_stat.st_size,
        entry_stat.st_mtime_ns,
        entry_stat.st_ctime_ns,
        getattr(entry_stat, "st_flags", 0),
    )


def require_same_device(
    root_device: int, entry_stat: os.stat_result, relative: str
) -> None:
    """Reject implicit traversal across a cross-device boundary."""
    if entry_stat.st_dev != root_device:
        raise SnapshotError(
            f"cross-device entry requires an explicit exclusion: {relative}"
        )


def normalize_exclusions(values: list[str]) -> list[str]:
    """Return unique concrete project-relative exclusion roots."""
    normalized: list[str] = []
    for raw in values:
        value = raw
        path = PurePosixPath(value)
        if (
            not value
            or value == "."
            or "\\" in value
            or WINDOWS_DRIVE_PREFIX_RE.match(value)
            or path.is_absolute()
            or ".." in path.parts
            or any(char in value for char in "*?[]{}<>")
            or path.as_posix() != value
        ):
            raise SnapshotError(
                f"exclusion must be a concrete project-relative file or directory: {raw!r}"
            )
        canonical = path.as_posix()
        if canonical not in normalized:
            normalized.append(canonical)
    return sorted(normalized)


def exclusion_for(relative: str, exclusions: list[str]) -> str | None:
    """Return the exclusion root covering a relative path, if any."""
    for exclusion in exclusions:
        if relative == exclusion or relative.startswith(f"{exclusion}/"):
            return exclusion
    return None


def stable_file_hash(path: Path) -> tuple[str, os.stat_result]:
    """Hash one regular file and fail if it changes while being read."""
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            raise SnapshotError(f"entry changed type while opening: {path}")
        digest = hashlib.sha256()
        while chunk := os.read(descriptor, 1024 * 1024):
            digest.update(chunk)
        after = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    if stat_identity(before) != stat_identity(after):
        raise SnapshotError(f"file changed while hashing: {path}")
    return digest.hexdigest(), before


def add_record(digest: Any, kind: str, relative: str, *fields: object) -> None:
    """Add an unambiguous tree record to the aggregate digest."""
    values = (kind, relative, *(str(field) for field in fields))
    digest.update("\0".join(values).encode("utf-8", "surrogateescape"))
    digest.update(b"\0\0")


def add_metadata_record(
    digest: Any, kind: str, relative: str, entry_stat: os.stat_result
) -> None:
    """Add mutation-sensitive portable POSIX metadata where the platform exposes it."""
    add_record(
        digest,
        kind,
        relative,
        stat.S_IMODE(entry_stat.st_mode),
        getattr(entry_stat, "st_uid", -1),
        getattr(entry_stat, "st_gid", -1),
        entry_stat.st_size,
        entry_stat.st_mtime_ns,
        entry_stat.st_ctime_ns,
        getattr(entry_stat, "st_flags", 0),
    )


def snapshot_once(resolved: Path, exclusions: list[str]) -> dict[str, Any]:
    """Traverse a trusted, quiescent tree once without following static symlinks."""
    root_device = resolved.stat(follow_symlinks=False).st_dev
    tree_digest = hashlib.sha256()
    tree_digest.update(f"{SCHEMA}\0{ALGORITHM}\0".encode())
    metadata_digest = hashlib.sha256()
    metadata_digest.update(f"{SCHEMA}\0{METADATA_ALGORITHM}\0".encode())
    for exclusion in exclusions:
        tree_digest.update(f"exclude\0{exclusion}\0".encode("utf-8", "surrogateescape"))
        metadata_digest.update(
            f"exclude\0{exclusion}\0".encode("utf-8", "surrogateescape")
        )

    counts = {"directories": 0, "files": 0, "symlinks": 0, "special": 0}
    matched_exclusions: set[str] = set()
    excluded_roots = 0

    def visit(directory: Path, relative_directory: str) -> None:
        nonlocal excluded_roots
        before = directory.stat(follow_symlinks=False)
        if not stat.S_ISDIR(before.st_mode):
            raise SnapshotError(
                f"entry changed type before directory scan: {directory}"
            )
        if relative_directory:
            counts["directories"] += 1
            add_record(
                tree_digest,
                "D",
                relative_directory,
                stat.S_IMODE(before.st_mode),
            )
            add_metadata_record(metadata_digest, "D", relative_directory, before)
        else:
            add_metadata_record(metadata_digest, "R", "", before)
        try:
            with os.scandir(directory) as scan:
                entries = sorted(scan, key=lambda item: item.name)
        except OSError as exc:
            raise SnapshotError(f"cannot read directory {directory}: {exc}") from exc

        for entry in entries:
            relative = (
                f"{relative_directory}/{entry.name}"
                if relative_directory
                else entry.name
            )
            excluded_by = exclusion_for(relative, exclusions)
            if excluded_by is not None:
                matched_exclusions.add(excluded_by)
                excluded_roots += 1
                continue

            path = Path(entry.path)
            try:
                entry_stat = entry.stat(follow_symlinks=False)
            except OSError as exc:
                raise SnapshotError(f"cannot inspect {path}: {exc}") from exc
            require_same_device(root_device, entry_stat, relative)
            mode = stat.S_IMODE(entry_stat.st_mode)

            if stat.S_ISDIR(entry_stat.st_mode):
                visit(path, relative)
            elif stat.S_ISREG(entry_stat.st_mode):
                content_digest, stable_stat = stable_file_hash(path)
                counts["files"] += 1
                add_record(
                    tree_digest,
                    "F",
                    relative,
                    stat.S_IMODE(stable_stat.st_mode),
                    stable_stat.st_size,
                    content_digest,
                )
                add_metadata_record(metadata_digest, "F", relative, stable_stat)
            elif stat.S_ISLNK(entry_stat.st_mode):
                try:
                    target = os.readlink(path)
                    after = path.lstat()
                except OSError as exc:
                    raise SnapshotError(f"cannot read symlink {path}: {exc}") from exc
                if stat_identity(entry_stat) != stat_identity(after):
                    raise SnapshotError(f"symlink changed while reading: {path}")
                counts["symlinks"] += 1
                add_record(tree_digest, "L", relative, mode, target)
                add_metadata_record(metadata_digest, "L", relative, entry_stat)
            else:
                try:
                    after = path.lstat()
                except OSError as exc:
                    raise SnapshotError(f"cannot re-inspect {path}: {exc}") from exc
                if stat_identity(entry_stat) != stat_identity(after):
                    raise SnapshotError(f"special entry changed while reading: {path}")
                counts["special"] += 1
                add_record(
                    tree_digest, "S", relative, mode, stat.S_IFMT(entry_stat.st_mode)
                )
                add_metadata_record(metadata_digest, "S", relative, entry_stat)

        after = directory.stat(follow_symlinks=False)
        if stat_identity(before) != stat_identity(after):
            raise SnapshotError(f"directory changed while scanning: {directory}")

    visit(resolved, "")
    return {
        "schema": SCHEMA,
        "algorithm": ALGORITHM,
        "metadata_algorithm": METADATA_ALGORITHM,
        "root": str(resolved),
        "scope": "complete" if not exclusions else "bounded",
        "exclusions": exclusions,
        "matched_exclusions": sorted(matched_exclusions),
        "unmatched_exclusions": sorted(set(exclusions) - matched_exclusions),
        "excluded_root_count": excluded_roots,
        "file_count": counts["files"],
        "directory_count": counts["directories"],
        "symlink_count": counts["symlinks"],
        "special_entry_count": counts["special"],
        "entry_count": sum(counts.values()),
        "digest": tree_digest.hexdigest(),
        "metadata_digest": metadata_digest.hexdigest(),
        "represented_tree_fields": [
            "relative paths",
            "entry types",
            "regular-file contents and sizes",
            "permission modes",
            "symlink targets",
        ],
        "represented_metadata_fields": [
            "root and entry modes",
            "owner and group identifiers when exposed",
            "sizes",
            "mtime_ns",
            "ctime_ns",
            "platform flags when exposed",
        ],
        "unrepresented_metadata": [
            "atime",
            "ACLs",
            "extended attributes",
            "device and inode identity in the emitted digest",
            "hard-link topology and link counts",
            "birth time when exposed",
            "allocation and sparse-file metadata",
        ],
        "unrepresented_metadata_is_exhaustive": False,
        "possible_observer_side_effects": [
            "file or directory atime updates caused by reads"
        ],
    }


def observation_identity(result: dict[str, Any]) -> tuple[Any, ...]:
    """Return fields that must match across the two traversal observations."""
    return (
        result["root"],
        result["scope"],
        tuple(result["exclusions"]),
        tuple(result["matched_exclusions"]),
        tuple(result["unmatched_exclusions"]),
        result["excluded_root_count"],
        result["file_count"],
        result["directory_count"],
        result["symlink_count"],
        result["special_entry_count"],
        result["entry_count"],
        result["digest"],
        result["metadata_digest"],
    )


def snapshot(root: Path, exclusions: list[str]) -> dict[str, Any]:
    """Return two matching observations of a trusted, quiescent project tree."""
    started_at = timestamp()
    try:
        resolved = root.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise SnapshotError(f"target cannot be resolved safely: {root}") from exc
    if not resolved.is_dir():
        raise SnapshotError(f"target is not a directory: {resolved}")

    first = snapshot_once(resolved, exclusions)
    second = snapshot_once(resolved, exclusions)
    if observation_identity(first) != observation_identity(second):
        raise SnapshotError("two sequential traversal observations did not match")

    completed_at = timestamp()
    second.update(
        {
            "observation_started_at": started_at,
            "observation_completed_at": completed_at,
            "observed_at": completed_at,
            "observation_passes": 2,
            "observation_assurance": "two_matching_sequential_traversals",
            "atomic_snapshot": False,
            "required_precondition": "trusted_quiescent_target",
            "concurrent_replacement_protection": False,
        }
    )
    return second


def comparison(
    result: dict[str, Any],
    expected_digest: str | None,
    expected_metadata_digest: str | None,
    expected_count: int | None,
) -> dict[str, Any]:
    """Compare requested parity fields without turning missing expectations into passes."""
    digest_state = "not_requested"
    metadata_state = "not_requested"
    count_state = "not_requested"
    if expected_digest is not None:
        digest_state = (
            "matched" if result["digest"] == expected_digest else "mismatched"
        )
    if expected_metadata_digest is not None:
        metadata_state = (
            "matched"
            if result["metadata_digest"] == expected_metadata_digest
            else "mismatched"
        )
    if expected_count is not None:
        count_state = (
            "matched" if result["file_count"] == expected_count else "mismatched"
        )
    requested_count = sum(
        expected is not None
        for expected in (expected_digest, expected_metadata_digest, expected_count)
    )
    states = {digest_state, metadata_state, count_state}
    if requested_count == 0:
        overall = "not_compared"
    elif "mismatched" in states:
        overall = "mismatched"
    elif result["scope"] == "bounded":
        overall = (
            "matched_within_bounded_scope"
            if requested_count == 3
            else "requested_fields_matched_within_bounded_scope"
        )
    elif requested_count == 3:
        overall = "matched"
    else:
        overall = "requested_fields_matched"
    return {
        "digest": digest_state,
        "metadata_digest": metadata_state,
        "file_count": count_state,
        "expected_digest": expected_digest,
        "expected_metadata_digest": expected_metadata_digest,
        "expected_file_count": expected_count,
        "result": overall,
    }


def render_text(result: dict[str, Any]) -> str:
    """Render a concise human-readable record."""
    exclusions = ", ".join(result["exclusions"]) or "none"
    matched_exclusions = ", ".join(result["matched_exclusions"]) or "none"
    unmatched_exclusions = ", ".join(result["unmatched_exclusions"]) or "none"
    compare = result["comparison"]
    return "\n".join(
        (
            f"schema: {result['schema']}",
            f"algorithm: {result['algorithm']}",
            f"metadata_algorithm: {result['metadata_algorithm']}",
            f"observation_started_at: {result['observation_started_at']}",
            f"observation_completed_at: {result['observation_completed_at']}",
            f"observation_passes: {result['observation_passes']}",
            f"observation_assurance: {result['observation_assurance']}",
            f"atomic_snapshot: {str(result['atomic_snapshot']).lower()}",
            (
                "concurrent_replacement_protection: "
                f"{str(result['concurrent_replacement_protection']).lower()}"
            ),
            f"required_precondition: {result['required_precondition']}",
            "possible_observer_side_effects: "
            + ", ".join(result["possible_observer_side_effects"]),
            f"root: {result['root']}",
            f"scope: {result['scope']}",
            f"exclusions: {exclusions}",
            f"matched_exclusions: {matched_exclusions}",
            f"unmatched_exclusions: {unmatched_exclusions}",
            f"file_count: {result['file_count']}",
            f"directory_count: {result['directory_count']}",
            f"symlink_count: {result['symlink_count']}",
            f"special_entry_count: {result['special_entry_count']}",
            f"entry_count: {result['entry_count']}",
            f"digest: {result['digest']}",
            f"metadata_digest: {result['metadata_digest']}",
            f"represented_tree_fields: {', '.join(result['represented_tree_fields'])}",
            "represented_metadata_fields: "
            + ", ".join(result["represented_metadata_fields"]),
            "unrepresented_metadata_known_examples: "
            + ", ".join(result["unrepresented_metadata"]),
            (
                "unrepresented_metadata_is_exhaustive: "
                f"{str(result['unrepresented_metadata_is_exhaustive']).lower()}"
            ),
            f"expected_digest: {compare['expected_digest'] or 'not_requested'}",
            "expected_metadata_digest: "
            + (compare["expected_metadata_digest"] or "not_requested"),
            "expected_file_count: "
            + (
                str(compare["expected_file_count"])
                if compare["expected_file_count"] is not None
                else "not_requested"
            ),
            f"tree_digest_comparison: {compare['digest']}",
            f"metadata_digest_comparison: {compare['metadata_digest']}",
            f"file_count_comparison: {compare['file_count']}",
            f"parity: {compare['result']}",
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="project tree to observe")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="PATH",
        help="concrete project-relative exclusion root; repeat as needed",
    )
    parser.add_argument(
        "--expect-digest", help="fail when the SHA-256 tree digest differs"
    )
    parser.add_argument(
        "--expect-metadata-digest",
        help="fail when the mutation-sensitive metadata digest differs",
    )
    parser.add_argument(
        "--expect-file-count", type=int, help="fail when the regular-file count differs"
    )
    parser.add_argument("--text", action="store_true", help="emit text instead of JSON")
    args = parser.parse_args()

    expected_digest = args.expect_digest.lower() if args.expect_digest else None
    expected_metadata_digest = (
        args.expect_metadata_digest.lower() if args.expect_metadata_digest else None
    )
    if expected_digest is not None and not DIGEST_RE.fullmatch(expected_digest):
        parser.error("--expect-digest must be exactly 64 hexadecimal characters")
    if expected_metadata_digest is not None and not DIGEST_RE.fullmatch(
        expected_metadata_digest
    ):
        parser.error(
            "--expect-metadata-digest must be exactly 64 hexadecimal characters"
        )
    if args.expect_file_count is not None and args.expect_file_count < 0:
        parser.error("--expect-file-count must be non-negative")

    try:
        exclusions = normalize_exclusions(args.exclude)
        result = snapshot(args.root, exclusions)
    except (OSError, SnapshotError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    result["comparison"] = comparison(
        result, expected_digest, expected_metadata_digest, args.expect_file_count
    )
    if args.text:
        print(render_text(result))
    else:
        print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if result["comparison"]["result"] == "mismatched" else 0


if __name__ == "__main__":
    sys.exit(main())
