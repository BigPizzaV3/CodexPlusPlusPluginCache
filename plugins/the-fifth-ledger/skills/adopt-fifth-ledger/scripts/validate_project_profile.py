#!/usr/bin/env python3
"""Validate a canonical Fifth Ledger TOML profile without validating routed truth."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
import subprocess
import sys
import unicodedata
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any

import tomllib

SCHEMA = "fifth-ledger.project.v1"
VISIBILITIES = {"tracked-public", "ignored-local", "external-private"}
TOP_LEVEL_KEYS = {
    "schema",
    "status",
    "profile_path",
    "visibility",
    "last_verified",
    "verification_scope",
    "routed_paths",
    "evidence_expectations",
    "surfaces",
    "protected_invariants",
    "authority",
    "lifecycle",
}
AUTHORITY_KEYS = {
    "project_owner_state",
    "project_owner",
    "owner_resolution_authority",
    "profile_acceptance_authority_state",
    "profile_acceptance_authority",
    "profile_acceptance_resolution_authority",
}
LIFECYCLE_KEYS = {
    "proposal_decision",
    "implementation",
    "validation",
    "commit",
    "installation_marketplace",
    "publication_release",
    "closeout",
}
STRING_ARRAY_KEYS = {
    "evidence_expectations",
    "surfaces",
    "protected_invariants",
}
UNRESOLVED_OWNER_VALUES = {
    "",
    "authority",
    "n a",
    "none",
    "not available",
    "not identified",
    "not known",
    "not supplied",
    "null",
    "owner",
    "pending",
    "placeholder",
    "tba",
    "tbc",
    "tbd",
    "todo",
    "to be determined",
    "unassigned",
    "unavailable",
    "unset",
    "unknown",
    "unconfirmed",
    "undecided",
    "unresolved",
}
UNRESOLVED_OWNER_PREFIXES = (
    "assign later",
    "awaiting ",
    "confirm later",
    "decide later",
    "not identified ",
    "not known ",
    "not supplied ",
    "not yet ",
    "pending ",
    "tba ",
    "tbc ",
    "tbd ",
    "to assign ",
    "to confirm ",
    "to decide ",
    "to be assigned ",
    "to be confirmed ",
    "to be determined ",
    "todo ",
    "unassigned ",
    "unknown ",
    "unconfirmed ",
    "undecided ",
    "unresolved ",
)
INSTRUCTIONAL_OWNER_FRAGMENTS = (
    "the project owner for project owned profiles",
    "external acceptance does not",
    "record the evidence",
    "required when",
    "use unavailable unless",
)
UNAVAILABLE_OWNER_ACCEPTANCE_ALIASES = {
    "owner",
    "project owner",
    "target owner",
    "the owner",
    "the project owner",
    "the target owner",
}
TARGET_ROLE_WORDS = {
    "admin",
    "administrator",
    "custodian",
    "delegate",
    "lead",
    "maintainer",
    "owner",
    "steward",
}
TARGET_SCOPE_WORDS = {
    "artifact",
    "codebase",
    "component",
    "package",
    "product",
    "project",
    "repo",
    "repository",
    "source",
    "system",
    "target",
    "workspace",
}
GENERIC_ROLE_MODIFIERS = {
    "admin",
    "administrator",
    "acting",
    "custodian",
    "current",
    "delegate",
    "designated",
    "existing",
    "lead",
    "maintainer",
    "named",
    "owner",
    "s",
    "steward",
    "the",
}
DEFAULT_IGNORABLE_RANGES = (
    (0x00AD, 0x00AD),
    (0x034F, 0x034F),
    (0x061C, 0x061C),
    (0x115F, 0x1160),
    (0x17B4, 0x17B5),
    (0x180B, 0x180F),
    (0x200B, 0x200F),
    (0x202A, 0x202E),
    (0x2060, 0x206F),
    (0x3164, 0x3164),
    (0xFE00, 0xFE0F),
    (0xFEFF, 0xFEFF),
    (0xFFA0, 0xFFA0),
    (0xFFF0, 0xFFF8),
    (0x1BCA0, 0x1BCA3),
    (0x1D173, 0x1D17A),
    (0xE0000, 0xE0FFF),
)
WINDOWS_DRIVE_PREFIX_RE = re.compile(r"^[A-Za-z]:")
ROUTE_FORBIDDEN_CHARACTERS = frozenset('\\:*?[]{}<>"|')
MAX_PROFILE_BYTES = 256 * 1024
MAX_ROUTED_PATHS = 128
MAX_COLLECTION_ITEMS = 256
MAX_STRING_LENGTH = 4096
MAX_STRUCTURE_NODES = 2048
MAX_STRUCTURE_DEPTH = 16
PROFILE_READ_BYTES = 64 * 1024
TRUSTED_GIT_EXECUTABLE = shutil.which("git", path=os.defpath)
GIT_TIMEOUT_SECONDS = 15


class ProfileReadError(ValueError):
    """Raised when an untrusted structural profile cannot be read safely."""


def read_profile_bytes(profile: Path) -> bytes:
    """Read one regular non-symlink profile through a bounded pinned descriptor."""
    flags = (
        os.O_RDONLY
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NONBLOCK", 0)
    )
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(profile, flags)
    except OSError as exc:
        raise ProfileReadError(f"profile cannot be opened safely: {exc}") from exc
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise ProfileReadError("profile must be a regular file")
        if metadata.st_size > MAX_PROFILE_BYTES:
            raise ProfileReadError(
                f"profile exceeds the {MAX_PROFILE_BYTES}-byte structural limit"
            )
        chunks: list[bytes] = []
        total = 0
        while True:
            remaining = MAX_PROFILE_BYTES + 1 - total
            if remaining <= 0:
                raise ProfileReadError(
                    f"profile exceeds the {MAX_PROFILE_BYTES}-byte structural limit"
                )
            chunk = os.read(descriptor, min(PROFILE_READ_BYTES, remaining))
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_PROFILE_BYTES:
                raise ProfileReadError(
                    f"profile exceeds the {MAX_PROFILE_BYTES}-byte structural limit"
                )
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def validate_structure_bounds(data: Any, errors: list[str]) -> None:
    """Bound parsed profile depth, nodes, collections, keys, and string values."""
    stack: list[tuple[str, Any, int]] = [("profile", data, 0)]
    nodes = 0
    while stack:
        path, value, depth = stack.pop()
        nodes += 1
        if nodes > MAX_STRUCTURE_NODES:
            errors.append(
                f"profile exceeds the {MAX_STRUCTURE_NODES}-node structural limit"
            )
            return
        if depth > MAX_STRUCTURE_DEPTH:
            errors.append(
                f"{path} exceeds the {MAX_STRUCTURE_DEPTH}-level structural limit"
            )
            return
        if isinstance(value, str):
            if len(value) > MAX_STRING_LENGTH:
                errors.append(
                    f"{path} exceeds the {MAX_STRING_LENGTH}-character string limit"
                )
            continue
        if isinstance(value, dict):
            if len(value) > MAX_COLLECTION_ITEMS:
                errors.append(
                    f"{path} exceeds the {MAX_COLLECTION_ITEMS}-item collection limit"
                )
                return
            for key, nested in value.items():
                if len(key) > MAX_STRING_LENGTH:
                    errors.append(
                        f"{path} contains a key over the "
                        f"{MAX_STRING_LENGTH}-character string limit"
                    )
                    return
                stack.append((f"{path}.{key}", nested, depth + 1))
            continue
        if isinstance(value, list):
            if len(value) > MAX_COLLECTION_ITEMS:
                errors.append(
                    f"{path} exceeds the {MAX_COLLECTION_ITEMS}-item collection limit"
                )
                return
            for index, nested in enumerate(value):
                stack.append((f"{path}[{index}]", nested, depth + 1))


def normalized_authority_value(value: str) -> str:
    """Normalize rendered separators for placeholder and generic-role comparison."""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return re.sub(r"[\W_]+", " ", normalized).strip()


def has_ambiguous_unicode(text: str) -> bool:
    """Reject invisible controls and separators that can disguise structural values."""
    for char in text:
        codepoint = ord(char)
        category = unicodedata.category(char)
        if category in {"Cc", "Cf", "Cs"}:
            return True
        if char != " " and char.isspace():
            return True
        name = unicodedata.name(char, "")
        if codepoint > 127 and ("SLASH" in name or "SOLIDUS" in name):
            return True
        if any(start <= codepoint <= end for start, end in DEFAULT_IGNORABLE_RANGES):
            return True
    return False


def strings_in(value: Any):
    """Yield all string values from a parsed TOML document."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for nested in value.values():
            yield from strings_in(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from strings_in(nested)


def required_string(
    mapping: dict[str, Any], key: str, errors: list[str], *, context: str = "profile"
) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{context}.{key} must be one nonempty string")
        return ""
    if value != value.strip():
        errors.append(
            f"{context}.{key} must not contain leading or trailing whitespace"
        )
    return value


def optional_string(
    mapping: dict[str, Any], key: str, errors: list[str], *, context: str = "profile"
) -> str | None:
    if key not in mapping:
        return None
    value = mapping[key]
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{context}.{key} must be one nonempty string when present")
        return None
    if value != value.strip():
        errors.append(
            f"{context}.{key} must not contain leading or trailing whitespace"
        )
    return value


def is_unresolved(value: str) -> bool:
    words = value.split()
    for acronym in ("tba", "tbc", "tbd", "todo"):
        letters = list(acronym)
        if words[: len(letters)] == letters:
            value = " ".join([acronym, *words[len(letters) :]])
            break
    return (
        value in UNRESOLVED_OWNER_VALUES
        or any(
            value == prefix.rstrip() or value.startswith(prefix)
            for prefix in UNRESOLVED_OWNER_PREFIXES
        )
        or any(fragment in value for fragment in INSTRUCTIONAL_OWNER_FRAGMENTS)
    )


def is_generic_target_role(value: str) -> bool:
    """Reject obvious aliases that merely restate the unavailable target role.

    This is conservative hygiene for common unresolved forms, not semantic identity
    proof. Human evidence still owns whether a non-placeholder value names a real,
    distinct authority.
    """
    if value in UNAVAILABLE_OWNER_ACCEPTANCE_ALIASES:
        return True
    words = set(value.split())
    if words & TARGET_ROLE_WORDS and words & TARGET_SCOPE_WORDS:
        bare_alias_words = (
            TARGET_ROLE_WORDS
            | TARGET_SCOPE_WORDS
            | GENERIC_ROLE_MODIFIERS
            | {"for", "of"}
        )
        return words <= bare_alias_words
    return bool(words & TARGET_ROLE_WORDS) and words <= GENERIC_ROLE_MODIFIERS


def is_host_independent_route_syntax(raw: str) -> bool:
    """Return whether a route has canonical POSIX-relative separator syntax."""
    if (
        raw == "."
        or raw.startswith("/")
        or WINDOWS_DRIVE_PREFIX_RE.match(raw)
        or "://" in raw
        or has_ambiguous_unicode(raw)
        or any(char in ROUTE_FORBIDDEN_CHARACTERS for char in raw)
    ):
        return False
    route = PurePosixPath(raw)
    return route.as_posix() == raw and ".." not in route.parts


def validate_authority(
    authority: Any, status: str, errors: list[str]
) -> tuple[str, str]:
    """Validate closed owner and profile-acceptance authority states."""
    if not isinstance(authority, dict):
        errors.append("profile.authority must be one TOML table")
        return "", ""
    unknown = sorted(set(authority) - AUTHORITY_KEYS)
    if unknown:
        errors.append(f"profile.authority contains unsupported keys: {unknown!r}")

    owner_state = required_string(
        authority, "project_owner_state", errors, context="profile.authority"
    )
    owner = required_string(
        authority, "project_owner", errors, context="profile.authority"
    )
    acceptance_state = required_string(
        authority,
        "profile_acceptance_authority_state",
        errors,
        context="profile.authority",
    )
    acceptance = required_string(
        authority,
        "profile_acceptance_authority",
        errors,
        context="profile.authority",
    )

    if owner_state not in {"identified", "unavailable"}:
        errors.append("project_owner_state must be 'identified' or 'unavailable'")
    if acceptance_state not in {"identified", "unavailable"}:
        errors.append(
            "profile_acceptance_authority_state must be 'identified' or 'unavailable'"
        )

    normalized_owner = normalized_authority_value(owner)
    owner_resolution = optional_string(
        authority,
        "owner_resolution_authority",
        errors,
        context="profile.authority",
    )
    if owner_state == "identified":
        if is_unresolved(normalized_owner) or is_generic_target_role(normalized_owner):
            errors.append("identified project owner requires a non-placeholder value")
        if owner_resolution is not None:
            errors.append(
                "identified project owner must not declare owner_resolution_authority"
            )
    elif owner_state == "unavailable":
        if normalized_owner != "unavailable":
            errors.append(
                "unavailable project owner state requires project_owner = 'unavailable'"
            )
        if owner_resolution is None:
            errors.append(
                "unavailable project owner requires owner_resolution_authority"
            )
        elif is_unresolved(normalized_authority_value(owner_resolution)):
            errors.append(
                "owner_resolution_authority must record concrete authority or evidence"
            )

    normalized_acceptance = normalized_authority_value(acceptance)
    acceptance_resolution = optional_string(
        authority,
        "profile_acceptance_resolution_authority",
        errors,
        context="profile.authority",
    )
    if acceptance_state == "identified":
        if is_unresolved(normalized_acceptance):
            errors.append(
                "identified profile acceptance authority requires a concrete value"
            )
        if owner_state == "unavailable" and is_generic_target_role(
            normalized_acceptance
        ):
            errors.append(
                "unavailable target-owner role cannot identify the separate profile "
                "acceptance authority"
            )
        if acceptance_resolution is not None:
            errors.append(
                "identified profile acceptance authority must not declare "
                "profile_acceptance_resolution_authority"
            )
    elif acceptance_state == "unavailable":
        if normalized_acceptance != "unavailable":
            errors.append(
                "unavailable profile acceptance authority state requires "
                "profile_acceptance_authority = 'unavailable'"
            )
        if acceptance_resolution is None:
            errors.append(
                "unavailable profile acceptance authority requires "
                "profile_acceptance_resolution_authority"
            )
        elif is_unresolved(normalized_authority_value(acceptance_resolution)):
            errors.append(
                "profile_acceptance_resolution_authority must record concrete authority"
            )

    if status == "accepted" and acceptance_state != "identified":
        errors.append("accepted profile requires identified acceptance authority")
    return owner_state, acceptance_state


def validate_document(
    data: dict[str, Any], errors: list[str], warnings: list[str]
) -> tuple[str, str, str, list[str]]:
    """Validate the closed TOML schema and return placement/routing values."""
    unknown = sorted(set(data) - TOP_LEVEL_KEYS)
    if unknown:
        errors.append(f"profile contains unsupported top-level keys: {unknown!r}")

    schema = required_string(data, "schema", errors)
    status = required_string(data, "status", errors)
    profile_path = required_string(data, "profile_path", errors)
    visibility = required_string(data, "visibility", errors)
    verified = required_string(data, "last_verified", errors)

    if schema and schema != SCHEMA:
        errors.append(f"unsupported profile schema {schema!r}")
    if status and status not in {"accepted", "proposed"}:
        errors.append("status must be 'accepted' or 'proposed'")
    if visibility and visibility not in VISIBILITIES:
        errors.append(f"unsupported visibility {visibility!r}")
    if verified and verified != "unverified":
        try:
            date.fromisoformat(verified)
        except ValueError:
            errors.append("last_verified must be 'unverified' or an ISO date string")
    if verified == "unverified":
        warnings.append("routing and placement remain unverified")

    optional_string(data, "verification_scope", errors)
    for key in STRING_ARRAY_KEYS:
        if key not in data:
            continue
        value = data[key]
        if not isinstance(value, list) or not value or not all(
            isinstance(item, str) and item.strip() for item in value
        ):
            errors.append(f"profile.{key} must be an array of unique nonempty strings")
        elif any(item != item.strip() for item in value):
            errors.append(
                f"profile.{key} entries must not contain leading or trailing whitespace"
            )
        elif len(value) != len(set(value)):
            errors.append(f"profile.{key} must be an array of unique nonempty strings")

    lifecycle = data.get("lifecycle")
    if lifecycle is not None:
        if not isinstance(lifecycle, dict):
            errors.append("profile.lifecycle must be one TOML table")
        else:
            lifecycle_unknown = sorted(set(lifecycle) - LIFECYCLE_KEYS)
            if lifecycle_unknown:
                errors.append(
                    "profile.lifecycle contains unsupported keys: "
                    f"{lifecycle_unknown!r}"
                )
            for key in lifecycle:
                optional_string(lifecycle, key, errors, context="profile.lifecycle")

    if any(has_ambiguous_unicode(value) for value in strings_in(data)):
        errors.append(
            "Unicode controls, default-ignorable characters, and non-ASCII separators "
            "are unsupported in a structural profile"
        )

    raw_paths = data.get("routed_paths")
    paths: list[str] = []
    if not isinstance(raw_paths, list) or not raw_paths:
        errors.append("profile.routed_paths must be a nonempty array of strings")
    elif len(raw_paths) > MAX_ROUTED_PATHS:
        errors.append(
            f"profile.routed_paths exceeds the {MAX_ROUTED_PATHS}-route limit"
        )
    elif not all(isinstance(item, str) and item.strip() for item in raw_paths):
        errors.append("profile.routed_paths must contain only nonempty strings")
    elif any(item != item.strip() for item in raw_paths):
        errors.append(
            "profile.routed_paths entries must not contain leading or trailing "
            "whitespace"
        )
    else:
        candidate_paths = list(raw_paths)
        invalid_paths = [
            path
            for path in candidate_paths
            if not is_host_independent_route_syntax(path)
        ]
        for path in invalid_paths:
            errors.append(
                "routed path must use canonical POSIX target-root-relative syntax: "
                f"{path!r}"
            )
        portable_paths: list[str] = []
        seen_paths: set[str] = set()
        duplicate_paths: set[str] = set()
        for path in candidate_paths:
            if not is_host_independent_route_syntax(path):
                continue
            portable_paths.append(path)
            if path in seen_paths:
                duplicate_paths.add(path)
            else:
                seen_paths.add(path)
        if duplicate_paths:
            errors.append("routed paths contain duplicates")
        paths = [
            path
            for path in portable_paths
            if path not in duplicate_paths
        ]

    validate_authority(data.get("authority"), status, errors)
    return profile_path, visibility, verified, paths


def canonical_git_environment() -> dict[str, str]:
    """Use the declared repository's canonical Git state, not caller overrides."""
    environment = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("GIT_")
    }
    environment.update(
        {
            "GIT_ALLOW_PROTOCOL": "",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_NO_LAZY_FETCH": "1",
            "GIT_NO_REPLACE_OBJECTS": "1",
            "GIT_OPTIONAL_LOCKS": "0",
            "GIT_PROTOCOL_FROM_USER": "0",
            "GIT_TERMINAL_PROMPT": "0",
        }
    )
    return environment


def git_command(root: Path, *args: str) -> list[str]:
    """Bind read-only Git queries to the trusted system executable and safe config."""
    if TRUSTED_GIT_EXECUTABLE is None or not Path(TRUSTED_GIT_EXECUTABLE).is_absolute():
        return []
    return [
        TRUSTED_GIT_EXECUTABLE,
        "-c",
        "core.fsmonitor=false",
        "-c",
        f"core.excludesFile={os.devnull}",
        "-C",
        str(root),
        *args,
    ]


def git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    command = git_command(root, *args)
    if not command:
        return subprocess.CompletedProcess([], 127, "", "trusted Git is unavailable")
    try:
        return subprocess.run(
            command,
            text=True,
            capture_output=True,
            check=False,
            env=canonical_git_environment(),
            timeout=GIT_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(
            command, 124, "", "Git query exceeded the structural timeout"
        )
    except OSError:
        return subprocess.CompletedProcess(
            command, 127, "", "trusted Git query is unavailable"
        )


def git_bytes(
    root: Path,
    *args: str,
    input_bytes: bytes,
) -> subprocess.CompletedProcess[bytes]:
    command = git_command(root, *args)
    if not command:
        return subprocess.CompletedProcess(
            [], 127, b"", b"trusted Git is unavailable"
        )
    try:
        return subprocess.run(
            command,
            input=input_bytes,
            capture_output=True,
            check=False,
            env=canonical_git_environment(),
            timeout=GIT_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(
            command, 124, b"", b"Git query exceeded the structural timeout"
        )
    except OSError:
        return subprocess.CompletedProcess(
            command, 127, b"", b"trusted Git query is unavailable"
        )


def discover_root(profile: Path) -> Path | None:
    result = git(profile.parent, "rev-parse", "--show-toplevel")
    return Path(result.stdout.strip()).resolve() if result.returncode == 0 else None


def profile_placement(
    profile: Path, root: Path, errors: list[str]
) -> tuple[Path, str, bool]:
    """Resolve profile placement without reading across a symlink boundary."""
    lexical_root = Path(os.path.abspath(root))
    lexical_profile = Path(os.path.abspath(profile))
    try:
        resolved_root = root.resolve()
    except (OSError, RuntimeError):
        errors.append(
            "project root cannot be resolved safely; declared placement cannot be "
            "proved"
        )
        return lexical_root, "external", False
    try:
        resolved_profile = profile.resolve()
    except (OSError, RuntimeError):
        errors.append(
            "profile path cannot be resolved safely; declared placement cannot be "
            "proved"
        )
        return resolved_root, "external", False
    if lexical_profile.is_symlink():
        errors.append("profile file is a symlink; declared placement cannot be proved")
    try:
        lexical_relative = lexical_profile.relative_to(lexical_root).as_posix()
        lexical_inside = True
    except ValueError:
        lexical_relative = "external"
        lexical_inside = False
    try:
        resolved_relative = resolved_profile.relative_to(resolved_root).as_posix()
        resolved_inside = True
    except ValueError:
        resolved_relative = "external"
        resolved_inside = False

    conflict = (
        lexical_root != resolved_root
        or lexical_profile != resolved_profile
        or lexical_inside != resolved_inside
        or (
            lexical_inside and resolved_inside and lexical_relative != resolved_relative
        )
    )
    if conflict:
        errors.append(
            "profile path crosses a symlink boundary; declared placement cannot be proved"
        )
    actual = lexical_relative if lexical_inside else "external"
    return resolved_root, actual, lexical_inside and resolved_inside and not conflict


def validate_git_placement(
    *,
    root: Path,
    relative: str,
    visibility: str,
    profile_inside: bool,
    require_index_match: bool,
    raw_profile: bytes,
    errors: list[str],
) -> None:
    if not profile_inside or visibility not in {"tracked-public", "ignored-local"}:
        return
    result = git(root, "rev-parse", "--show-toplevel")
    git_root = (
        Path(result.stdout.strip()).resolve()
        if result.returncode == 0 and result.stdout.strip()
        else None
    )
    if git_root != root:
        errors.append(
            f"cannot prove {visibility} visibility without a Git repository rooted at "
            "the declared project root"
        )
        return

    ignored = git(root, "check-ignore", "--no-index", "--quiet", "--", relative)
    if ignored.returncode not in {0, 1}:
        errors.append(
            f"Git ignore classification failed for {visibility} profile; placement "
            "cannot be proved"
        )
        return
    if visibility == "ignored-local":
        if ignored.returncode == 1:
            errors.append(
                "profile is declared ignored-local but Git does not ignore it"
            )
        tracked = git(root, "ls-files", "--error-unmatch", "--", relative)
        if tracked.returncode == 0:
            errors.append(
                "profile is declared ignored-local but Git tracks it in the index"
            )
        elif tracked.returncode != 1:
            errors.append(
                "Git index query failed for ignored-local profile; absence from the "
                "index cannot be proved"
            )
        return
    if ignored.returncode == 0:
        errors.append("profile is declared tracked-public but Git ignores it")

    tracked = git(root, "ls-files", "--error-unmatch", "--", relative)
    if tracked.returncode == 1:
        errors.append("profile is declared tracked-public but Git does not track it")
        return
    if tracked.returncode != 0:
        errors.append(
            "Git index query failed for tracked-public profile; placement cannot be "
            "proved"
        )
        return
    index_entry = git(root, "ls-files", "--stage", "--", relative)
    index_parts = index_entry.stdout.rstrip("\n").split("\t", 1)[0].split()
    index_mode = index_parts[0] if len(index_parts) == 3 else ""
    index_oid = index_parts[1] if len(index_parts) == 3 else ""
    index_stage = index_parts[2] if len(index_parts) == 3 else ""
    if index_mode not in {"100644", "100755"} or index_stage != "0":
        errors.append(
            "tracked-public profile requires one regular stage-zero Git entry"
        )
    index_type = git(root, "cat-file", "-t", index_oid) if index_oid else None
    if index_type is None or index_type.stdout.strip() != "blob":
        errors.append("tracked-public profile Git index entry must reference a blob")
    staged_size = git(root, "cat-file", "-s", f":{relative}")
    if staged_size.returncode != 0 or staged_size.stdout.strip() == "0":
        errors.append(
            "profile is declared tracked-public but Git records only intent-to-add, "
            "not a tracked profile blob"
        )
    if require_index_match and index_oid:
        worktree_oid = git_bytes(
            root,
            "hash-object",
            "--no-filters",
            "--stdin",
            input_bytes=raw_profile,
        )
        if (
            worktree_oid.returncode != 0
            or worktree_oid.stdout.decode().strip() != index_oid
        ):
            errors.append(
                "tracked-public profile worktree bytes do not match the Git index; "
                "stage the reviewed profile before a commit decision"
            )


def is_concrete_route_mode(mode: int) -> bool:
    """Return whether a routed target is a regular file or directory."""
    return stat.S_ISREG(mode) or stat.S_ISDIR(mode)


def validate_routes(root: Path, paths: list[str], errors: list[str]) -> int:
    valid_count = 0
    resolved_routes: set[Path] = set()
    for raw in paths:
        if not is_host_independent_route_syntax(raw):
            errors.append(
                "routed path must use canonical POSIX target-root-relative syntax: "
                f"{raw!r}"
            )
            continue
        try:
            resolved = (root / raw).resolve()
        except (OSError, RuntimeError):
            errors.append(f"routed path cannot be resolved safely: {raw!r}")
            continue
        if resolved == root:
            errors.append(f"routed path must resolve below the project root: {raw!r}")
            continue
        try:
            resolved.relative_to(root)
        except ValueError:
            errors.append(f"routed path escapes the project root: {raw!r}")
            continue
        if not resolved.exists():
            errors.append(f"routed path does not resolve: {raw!r}")
            continue
        try:
            mode = resolved.stat().st_mode
        except OSError as exc:
            errors.append(f"routed path cannot be inspected: {raw!r}: {exc}")
            continue
        if not is_concrete_route_mode(mode):
            errors.append(
                f"routed path must resolve to a regular file or directory: {raw!r}"
            )
            continue
        if resolved in resolved_routes:
            errors.append(f"routed paths resolve to the same target: {raw!r}")
            continue
        resolved_routes.add(resolved)
        valid_count += 1
    return valid_count


def validate(
    profile: Path,
    root: Path,
    *,
    require_index_match: bool = False,
) -> tuple[list[str], list[str], int]:
    errors: list[str] = []
    warnings: list[str] = []
    resolved_root, actual_relative, profile_inside = profile_placement(
        profile, root, errors
    )
    if errors:
        return errors, warnings, 0
    if profile.suffix != ".toml":
        return ["structural project profiles must use the .toml extension"], warnings, 0
    try:
        raw_profile = read_profile_bytes(profile)
        data = tomllib.loads(raw_profile.decode("utf-8"))
    except (
        ProfileReadError,
        UnicodeError,
        tomllib.TOMLDecodeError,
        RecursionError,
    ) as exc:
        return [f"invalid profile TOML: {exc}"], warnings, 0

    validate_structure_bounds(data, errors)
    if errors:
        return errors, warnings, 0

    declared_profile, visibility, _, paths = validate_document(data, errors, warnings)
    if require_index_match and visibility != "tracked-public":
        errors.append("--require-index-match requires a tracked-public profile")
    if declared_profile and declared_profile != actual_relative:
        errors.append(
            f"profile_path declares {declared_profile!r}, actual location is "
            f"{actual_relative!r}"
        )
    if visibility in {"tracked-public", "ignored-local"} and not profile_inside:
        errors.append(f"{visibility} profile must be inside the project root")
    if visibility == "external-private" and profile_inside:
        errors.append("external-private profile must be outside the project root")
    if visibility == "external-private" and not profile_inside:
        warnings.append(
            "external location is proved; privacy classification requires separate evidence"
        )

    validate_git_placement(
        root=resolved_root,
        relative=actual_relative,
        visibility=visibility,
        profile_inside=profile_inside,
        require_index_match=require_index_match,
        raw_profile=raw_profile,
        errors=errors,
    )
    valid_count = validate_routes(resolved_root, paths, errors)
    return errors, warnings, valid_count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    parser.add_argument("--project-root", type=Path)
    parser.add_argument(
        "--require-index-match",
        action="store_true",
        help="require a tracked-public profile's raw bytes to match the Git index",
    )
    args = parser.parse_args()

    profile = args.profile.expanduser().absolute()
    root = (
        args.project_root.expanduser().absolute()
        if args.project_root
        else discover_root(profile)
    )
    if root is None:
        print(
            "ERROR: could not discover project root; pass --project-root",
            file=sys.stderr,
        )
        return 2

    errors, warnings, valid_count = validate(
        profile,
        root,
        require_index_match=args.require_index_match,
    )
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(
        f"PASS: {valid_count} routed paths resolve; TOML profile location and routing "
        "are structurally coherent"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
