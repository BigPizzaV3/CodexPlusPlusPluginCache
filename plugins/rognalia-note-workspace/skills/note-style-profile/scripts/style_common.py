#!/usr/bin/env python3
"""Shared validation and append-only storage for note style profiles."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple


SCHEMA_VERSION = 1
REQUEST_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]{7,127}$")
SAMPLE_ID_PATTERN = re.compile(r"^sample-[a-z0-9][a-z0-9-]{2,63}$")
HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
SOURCE_KINDS = {
    "published_article",
    "draft",
    "writing_sample",
    "conversation_text",
}
PROFILE_KEYS = (
    "basic_voice",
    "rhythm",
    "opening",
    "headings",
    "specificity",
    "preferred_expressions",
    "avoid_expressions",
    "per_article",
    "never_invent",
)
INPUT_KEYS = (
    "schema_version",
    "request_id",
    "approved_at",
    "approval_obtained",
    "approval_scope",
    "status",
    "reason",
    "samples",
    "user_preferences",
    "profile",
    "uncertainties",
)
METADATA_KEYS = (
    "schema_version",
    "request_id",
    "payload_sha256",
    "revision",
    "approved_at",
    "saved_at",
    "status",
    "reason",
    "samples",
    "user_preferences",
    "profile",
    "uncertainties",
    "profile_path",
    "profile_sha256",
    "external_actions",
)
EVENT_KEYS = (
    "schema_version",
    "event_type",
    "request_id",
    "payload_sha256",
    "revision",
    "approved_at",
    "saved_at",
    "status",
    "profile_path",
    "profile_sha256",
    "metadata_path",
    "metadata_sha256",
    "external_actions",
)
TRANSACTION_KEYS = (
    "schema_version",
    "operation",
    "request_id",
    "payload_sha256",
    "revision",
    "current_before_sha256",
    "profile_path",
    "profile_sha256",
    "profile_text",
    "metadata_path",
    "metadata_sha256",
    "metadata_text",
    "event",
)
LOCK_KEYS = ("operation", "started_at", "pid", "token")
HEADING_MAP = (
    ("basic_voice", "基本の語り口"),
    ("rhythm", "文のリズム"),
    ("opening", "導入"),
    ("headings", "見出しと構成"),
    ("specificity", "具体性"),
    ("preferred_expressions", "好む表現"),
    ("avoid_expressions", "避ける表現"),
    ("per_article", "記事ごとに選ぶこと"),
    ("never_invent", "絶対に作らないもの"),
)


class StyleProfileError(ValueError):
    """Raised when profile input or managed data is invalid."""


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def check_exact_keys(value: Dict[str, Any], *, label: str, expected: Tuple[str, ...]) -> None:
    unknown = sorted(set(value) - set(expected))
    missing = sorted(set(expected) - set(value))
    if unknown:
        raise StyleProfileError(f"{label} has unknown fields: {', '.join(unknown)}")
    if missing:
        raise StyleProfileError(f"{label} is missing fields: {', '.join(missing)}")


def require_object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise StyleProfileError(f"{label} must be an object")
    return value


def require_text(
    value: Any,
    label: str,
    *,
    maximum: int,
    one_line: bool = False,
) -> str:
    if not isinstance(value, str):
        raise StyleProfileError(f"{label} must be text")
    text = value.strip()
    if not text:
        raise StyleProfileError(f"{label} must not be empty")
    if len(text) > maximum:
        raise StyleProfileError(f"{label} is too long")
    if one_line and ("\n" in text or "\r" in text):
        raise StyleProfileError(f"{label} must be one line")
    return text


def require_string_list(
    value: Any,
    label: str,
    *,
    minimum: int,
    maximum: int,
) -> List[str]:
    if not isinstance(value, list):
        raise StyleProfileError(f"{label} must be an array")
    if not minimum <= len(value) <= maximum:
        raise StyleProfileError(
            f"{label} must contain between {minimum} and {maximum} items"
        )
    normalized = [
        require_text(item, f"{label}[{index}]", maximum=240, one_line=True)
        for index, item in enumerate(value)
    ]
    if len(normalized) != len(set(normalized)):
        raise StyleProfileError(f"{label} must not contain duplicates")
    return normalized


def parse_timestamp(value: Optional[str], label: str = "timestamp") -> str:
    if value is None:
        moment = datetime.now(timezone.utc).astimezone()
    else:
        normalized = value.strip().replace("Z", "+00:00")
        try:
            moment = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise StyleProfileError(f"{label} must be ISO 8601") from exc
        if moment.tzinfo is None:
            raise StyleProfileError(f"{label} must include a timezone")
    return moment.isoformat(timespec="seconds")


def normalize_samples(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list) or not 1 <= len(value) <= 5:
        raise StyleProfileError("samples must contain between 1 and 5 items")
    samples: List[Dict[str, Any]] = []
    seen_ids = set()
    seen_hashes = set()
    for index, raw in enumerate(value):
        item = require_object(raw, f"samples[{index}]")
        check_exact_keys(
            item,
            label=f"samples[{index}]",
            expected=("sample_id", "source_kind", "content_sha256", "character_count"),
        )
        sample_id = require_text(
            item.get("sample_id"),
            f"samples[{index}].sample_id",
            maximum=71,
            one_line=True,
        )
        if SAMPLE_ID_PATTERN.fullmatch(sample_id) is None:
            raise StyleProfileError(f"samples[{index}].sample_id has invalid format")
        if sample_id in seen_ids:
            raise StyleProfileError("samples must not repeat sample_id")
        seen_ids.add(sample_id)
        source_kind = item.get("source_kind")
        if source_kind not in SOURCE_KINDS:
            raise StyleProfileError(f"samples[{index}].source_kind is invalid")
        content_hash = require_text(
            item.get("content_sha256"),
            f"samples[{index}].content_sha256",
            maximum=64,
            one_line=True,
        )
        if HASH_PATTERN.fullmatch(content_hash) is None:
            raise StyleProfileError(f"samples[{index}].content_sha256 is invalid")
        if content_hash in seen_hashes:
            raise StyleProfileError("samples must not repeat content_sha256")
        seen_hashes.add(content_hash)
        character_count = item.get("character_count")
        if (
            isinstance(character_count, bool)
            or not isinstance(character_count, int)
            or not 1 <= character_count <= 1_000_000
        ):
            raise StyleProfileError(f"samples[{index}].character_count is invalid")
        samples.append(
            {
                "sample_id": sample_id,
                "source_kind": source_kind,
                "content_sha256": content_hash,
                "character_count": character_count,
            }
        )
    return samples


def normalize_preferences(value: Any) -> Dict[str, List[str]]:
    preferences = require_object(value, "user_preferences")
    check_exact_keys(
        preferences,
        label="user_preferences",
        expected=("keep", "change", "variable"),
    )
    return {
        key: require_string_list(
            preferences.get(key), f"user_preferences.{key}", minimum=0, maximum=12
        )
        for key in ("keep", "change", "variable")
    }


def normalize_profile(value: Any) -> Dict[str, List[str]]:
    profile = require_object(value, "profile")
    check_exact_keys(profile, label="profile", expected=PROFILE_KEYS)
    return {
        key: require_string_list(
            profile.get(key), f"profile.{key}", minimum=1, maximum=8
        )
        for key in PROFILE_KEYS
    }


def normalize_config(value: Any) -> Dict[str, Any]:
    config = require_object(value, "config")
    check_exact_keys(config, label="config", expected=INPUT_KEYS)
    if config.get("schema_version") != SCHEMA_VERSION:
        raise StyleProfileError("schema_version must be 1")
    request_id = require_text(
        config.get("request_id"), "request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise StyleProfileError("request_id has invalid format")
    approved_at = parse_timestamp(config.get("approved_at"), "approved_at")
    if config.get("approval_obtained") is not True:
        raise StyleProfileError("approval_obtained must be true before saving")
    if config.get("approval_scope") != "save_style_profile_revision":
        raise StyleProfileError("approval_scope must be save_style_profile_revision")
    status = config.get("status")
    if status not in {"provisional", "confirmed"}:
        raise StyleProfileError("status must be provisional or confirmed")
    reason = require_text(config.get("reason"), "reason", maximum=500)
    samples = normalize_samples(config.get("samples"))
    if status == "confirmed" and len(samples) < 2:
        raise StyleProfileError("confirmed profile requires at least two samples")
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "approved_at": approved_at,
        "approval_obtained": True,
        "approval_scope": "save_style_profile_revision",
        "status": status,
        "reason": reason,
        "samples": samples,
        "user_preferences": normalize_preferences(config.get("user_preferences")),
        "profile": normalize_profile(config.get("profile")),
        "uncertainties": require_string_list(
            config.get("uncertainties"), "uncertainties", minimum=0, maximum=12
        ),
    }


def payload_sha256(config: Dict[str, Any]) -> str:
    return sha256_text(canonical_json(config))


def load_json_argument(value: str) -> Dict[str, Any]:
    if value == "-":
        import sys

        text = sys.stdin.read()
    else:
        path = Path(value)
        if not path.is_file() or path.is_symlink():
            raise StyleProfileError("config file is missing or unsafe")
        text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise StyleProfileError("config is invalid JSON") from exc
    return require_object(parsed, "config")


def resolve_workspace(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        raise StyleProfileError("workspace path must be absolute")
    if not candidate.is_dir() or candidate.is_symlink():
        raise StyleProfileError("workspace path is missing or unsafe")
    workspace = candidate.resolve()
    manifest_path = workspace / "workspace.json"
    profile_dir = workspace / "profile"
    current_path = profile_dir / "style-profile.md"
    for path, label, directory in (
        (manifest_path, "workspace.json", False),
        (profile_dir, "profile", True),
        (current_path, "profile/style-profile.md", False),
    ):
        if directory:
            valid = path.is_dir()
        else:
            valid = path.is_file()
        if not valid or path.is_symlink():
            raise StyleProfileError(f"{label} is missing or unsafe")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StyleProfileError("workspace.json is invalid") from exc
    if not isinstance(manifest, dict) or manifest.get("product_id") != "note-workspace":
        raise StyleProfileError("workspace is not a note Workspace")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise StyleProfileError("workspace schema_version is not supported")
    if manifest.get("status") != "ready":
        raise StyleProfileError(
            "workspace is not ready; migration or hold must be resolved first"
        )
    if manifest.get("data_owner") != "user":
        raise StyleProfileError("workspace data_owner must be user")
    return workspace


def render_profile(config: Dict[str, Any]) -> str:
    lines = ["# note文体プロフィール", ""]
    for key, heading in HEADING_MAP:
        lines.extend([f"## {heading}", ""])
        lines.extend(f"- {item}" for item in config["profile"][key])
        lines.append("")
    lines.extend(["## 今回の根拠と不確実性", ""])
    status_label = "暫定" if config["status"] == "provisional" else "確認済み"
    lines.append(f"- 状態: {status_label}。分析sampleは{len(config['samples'])}本。")
    if config["uncertainties"]:
        lines.extend(f"- {item}" for item in config["uncertainties"])
    else:
        lines.append("- 現時点で明示された不確実性はありません。")
    return "\n".join(lines).rstrip() + "\n"


def build_metadata(
    config: Dict[str, Any],
    *,
    revision: int,
    saved_at: str,
    profile_path: str,
    profile_hash: str,
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": config["request_id"],
        "payload_sha256": payload_sha256(config),
        "revision": revision,
        "approved_at": config["approved_at"],
        "saved_at": saved_at,
        "status": config["status"],
        "reason": config["reason"],
        "samples": config["samples"],
        "user_preferences": config["user_preferences"],
        "profile": config["profile"],
        "uncertainties": config["uncertainties"],
        "profile_path": profile_path,
        "profile_sha256": profile_hash,
        "external_actions": [],
    }


def build_event(metadata: Dict[str, Any], metadata_path: str, metadata_hash: str) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_type": "style_profile_saved",
        "request_id": metadata["request_id"],
        "payload_sha256": metadata["payload_sha256"],
        "revision": metadata["revision"],
        "approved_at": metadata["approved_at"],
        "saved_at": metadata["saved_at"],
        "status": metadata["status"],
        "profile_path": metadata["profile_path"],
        "profile_sha256": metadata["profile_sha256"],
        "metadata_path": metadata_path,
        "metadata_sha256": metadata_hash,
        "external_actions": [],
    }


def registry_path(workspace: Path) -> Path:
    return workspace / "profile/style-profile-history.jsonl"


def transaction_path(workspace: Path) -> Path:
    return workspace / "profile/.style-profile-transaction.json"


def history_dir(workspace: Path) -> Path:
    return workspace / "profile/style-profile-history"


def load_events(workspace: Path) -> List[Dict[str, Any]]:
    path = registry_path(workspace)
    if not path.exists():
        return []
    if not path.is_file() or path.is_symlink():
        raise StyleProfileError("style profile registry is unsafe")
    events: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise StyleProfileError(
                    f"style profile registry line {line_number} is invalid JSON"
                ) from exc
            events.append(require_object(value, f"style profile registry line {line_number}"))
    return events


def safe_history_file(workspace: Path, relative: Any, label: str) -> Path:
    text = require_text(relative, label, maximum=300, one_line=True)
    path_value = Path(text)
    if path_value.is_absolute() or ".." in path_value.parts:
        raise StyleProfileError(f"{label} is unsafe")
    if path_value.parts[:2] != ("profile", "style-profile-history"):
        raise StyleProfileError(f"{label} must be inside profile/style-profile-history")
    path = workspace / path_value
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise StyleProfileError(f"{label} is missing or unsafe")
    return path


def metadata_to_config(metadata: Dict[str, Any], label: str) -> Dict[str, Any]:
    check_exact_keys(metadata, label=label, expected=METADATA_KEYS)
    return normalize_config(
        {
            "schema_version": metadata.get("schema_version"),
            "request_id": metadata.get("request_id"),
            "approved_at": metadata.get("approved_at"),
            "approval_obtained": True,
            "approval_scope": "save_style_profile_revision",
            "status": metadata.get("status"),
            "reason": metadata.get("reason"),
            "samples": metadata.get("samples"),
            "user_preferences": metadata.get("user_preferences"),
            "profile": metadata.get("profile"),
            "uncertainties": metadata.get("uncertainties"),
        }
    )


def validate_event(event: Dict[str, Any], label: str) -> None:
    check_exact_keys(event, label=label, expected=EVENT_KEYS)
    if event.get("schema_version") != SCHEMA_VERSION:
        raise StyleProfileError(f"{label}.schema_version is invalid")
    if event.get("event_type") != "style_profile_saved":
        raise StyleProfileError(f"{label}.event_type is invalid")
    request_id = require_text(event.get("request_id"), f"{label}.request_id", maximum=128)
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise StyleProfileError(f"{label}.request_id has invalid format")
    for field in ("payload_sha256", "profile_sha256", "metadata_sha256"):
        value = require_text(event.get(field), f"{label}.{field}", maximum=64)
        if HASH_PATTERN.fullmatch(value) is None:
            raise StyleProfileError(f"{label}.{field} is invalid")
    revision = event.get("revision")
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
        raise StyleProfileError(f"{label}.revision is invalid")
    parse_timestamp(event.get("approved_at"), f"{label}.approved_at")
    parse_timestamp(event.get("saved_at"), f"{label}.saved_at")
    if event.get("status") not in {"provisional", "confirmed"}:
        raise StyleProfileError(f"{label}.status is invalid")
    if event.get("external_actions") != []:
        raise StyleProfileError(f"{label}.external_actions must be empty")


def validate_style_data(workspace: Path) -> List[str]:
    errors: List[str] = []
    pending = transaction_path(workspace)
    if pending.exists():
        if not pending.is_file() or pending.is_symlink():
            return ["style profile transaction journal is unsafe"]
        return ["style profile transaction is pending recovery"]
    current_path = workspace / "profile/style-profile.md"
    try:
        current_text = current_path.read_text(encoding="utf-8")
        for _, heading in HEADING_MAP:
            if f"## {heading}" not in current_text:
                raise StyleProfileError(f"current profile is missing heading: {heading}")
        events = load_events(workspace)
    except (OSError, StyleProfileError) as exc:
        return [str(exc)]

    if not events:
        directory = history_dir(workspace)
        if directory.exists() and (
            not directory.is_dir() or directory.is_symlink() or any(directory.iterdir())
        ):
            errors.append("style profile history contains files without registry events")
        return errors

    seen_requests = set()
    expected_files = set()
    latest_text = ""
    for index, event in enumerate(events, start=1):
        label = f"style profile event {index}"
        try:
            validate_event(event, label)
            if event["revision"] != index:
                raise StyleProfileError(f"{label}.revision is not sequential")
            if event["request_id"] in seen_requests:
                raise StyleProfileError(f"{label}.request_id is duplicated")
            seen_requests.add(event["request_id"])
            suffix = f"style-profile-r{index:03d}"
            expected_profile = f"profile/style-profile-history/{suffix}.md"
            expected_metadata = f"profile/style-profile-history/{suffix}.json"
            if event["profile_path"] != expected_profile:
                raise StyleProfileError(f"{label}.profile_path does not match revision")
            if event["metadata_path"] != expected_metadata:
                raise StyleProfileError(f"{label}.metadata_path does not match revision")
            profile_path = safe_history_file(
                workspace, event["profile_path"], f"{label}.profile_path"
            )
            metadata_path = safe_history_file(
                workspace, event["metadata_path"], f"{label}.metadata_path"
            )
            expected_files.update({profile_path.name, metadata_path.name})
            profile_text = profile_path.read_text(encoding="utf-8")
            metadata_text = metadata_path.read_text(encoding="utf-8")
            if sha256_text(profile_text) != event["profile_sha256"]:
                raise StyleProfileError(f"{label} profile hash does not match")
            if sha256_text(metadata_text) != event["metadata_sha256"]:
                raise StyleProfileError(f"{label} metadata hash does not match")
            try:
                metadata = json.loads(metadata_text)
            except json.JSONDecodeError as exc:
                raise StyleProfileError(f"{label} metadata is invalid JSON") from exc
            metadata = require_object(metadata, f"{label} metadata")
            config = metadata_to_config(metadata, f"{label} metadata")
            if metadata.get("revision") != index:
                raise StyleProfileError(f"{label} metadata revision does not match")
            if metadata.get("saved_at") != event["saved_at"]:
                raise StyleProfileError(f"{label} saved_at does not match metadata")
            if metadata.get("profile_path") != event["profile_path"]:
                raise StyleProfileError(f"{label} profile_path does not match metadata")
            if metadata.get("profile_sha256") != event["profile_sha256"]:
                raise StyleProfileError(f"{label} profile hash does not match metadata")
            if metadata.get("external_actions") != []:
                raise StyleProfileError(f"{label} metadata external_actions must be empty")
            if payload_sha256(config) != event["payload_sha256"]:
                raise StyleProfileError(f"{label} payload hash does not match")
            if render_profile(config) != profile_text:
                raise StyleProfileError(f"{label} profile does not match metadata")
            latest_text = profile_text
        except (OSError, StyleProfileError) as exc:
            errors.append(str(exc))

    directory = history_dir(workspace)
    if not directory.is_dir() or directory.is_symlink():
        errors.append("style profile history directory is missing or unsafe")
    else:
        actual_files = {path.name for path in directory.iterdir() if path.is_file()}
        extras = sorted(actual_files - expected_files)
        missing = sorted(expected_files - actual_files)
        if extras:
            errors.append("style profile history has unregistered files: " + ", ".join(extras))
        if missing:
            errors.append("style profile history is missing files: " + ", ".join(missing))
    if latest_text and current_text != latest_text:
        errors.append("profile/style-profile.md does not match latest revision")
    return errors


@contextmanager
def style_lock(workspace: Path, saved_at: str) -> Iterator[None]:
    path = workspace / "profile/.style-profile.lock"
    token = secrets.token_hex(16)
    payload = {
        "operation": "save_style_profile",
        "started_at": saved_at,
        "pid": os.getpid(),
        "token": token,
    }

    def create() -> None:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(json_text(payload))
            handle.flush()
            os.fsync(handle.fileno())

    try:
        create()
    except FileExistsError as exc:
        existing = _read_style_lock(path)
        if _process_is_alive(existing["pid"]):
            raise StyleProfileError("style profile lock is held by a running process") from exc
        stale_path = path.with_name(f".style-profile.lock.stale-{token}")
        try:
            path.rename(stale_path)
        except (FileNotFoundError, FileExistsError, OSError) as claim_exc:
            raise StyleProfileError(
                "style profile lock changed while stale recovery was starting"
            ) from claim_exc
        try:
            if _process_is_alive(existing["pid"]):
                raise StyleProfileError("style profile lock owner became active again")
            create()
        except Exception:
            if not path.exists() and stale_path.exists():
                stale_path.rename(path)
            raise
        finally:
            try:
                stale_path.unlink()
            except FileNotFoundError:
                pass
    try:
        yield
    finally:
        try:
            current = _read_style_lock(path)
            if current.get("token") == token and current.get("pid") == os.getpid():
                path.unlink()
        except (FileNotFoundError, StyleProfileError):
            pass


def _read_style_lock(path: Path) -> Dict[str, Any]:
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise StyleProfileError("style profile lock is unsafe")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StyleProfileError("style profile lock is invalid; reconcile it first") from exc
    lock = require_object(value, "style profile lock")
    check_exact_keys(lock, label="style profile lock", expected=LOCK_KEYS)
    if lock.get("operation") != "save_style_profile":
        raise StyleProfileError("style profile lock operation is invalid")
    parse_timestamp(lock.get("started_at"), "style profile lock started_at")
    pid = lock.get("pid")
    if isinstance(pid, bool) or not isinstance(pid, int) or pid < 1:
        raise StyleProfileError("style profile lock pid is invalid")
    token = lock.get("token")
    if not isinstance(token, str) or re.fullmatch(r"[0-9a-f]{32}", token) is None:
        raise StyleProfileError("style profile lock token is invalid")
    return lock


def _process_is_alive(pid: int) -> bool:
    if pid == os.getpid():
        return True
    if os.name == "posix":
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        return True
    if os.name == "nt":
        try:
            import ctypes
            from ctypes import wintypes

            query_limited_information = 0x1000
            still_active = 259
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.OpenProcess.argtypes = [
                wintypes.DWORD,
                wintypes.BOOL,
                wintypes.DWORD,
            ]
            kernel32.OpenProcess.restype = wintypes.HANDLE
            kernel32.GetExitCodeProcess.argtypes = [
                wintypes.HANDLE,
                ctypes.POINTER(wintypes.DWORD),
            ]
            kernel32.GetExitCodeProcess.restype = wintypes.BOOL
            kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
            kernel32.CloseHandle.restype = wintypes.BOOL

            handle = kernel32.OpenProcess(query_limited_information, False, pid)
            if not handle:
                return ctypes.get_last_error() != 87
            try:
                exit_code = wintypes.DWORD()
                if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                    return True
                return exit_code.value == still_active
            finally:
                kernel32.CloseHandle(handle)
        except (AttributeError, OSError):
            return True
    return True


def write_new_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())


def replace_current(path: Path, text: str) -> None:
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise StyleProfileError("profile/style-profile.md is missing or unsafe")
    descriptor, temporary = tempfile.mkstemp(
        prefix=".style-profile-", suffix=".tmp", dir=str(path.parent)
    )
    temporary_path = Path(temporary)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(str(temporary_path), str(path))
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def append_event(workspace: Path, event: Dict[str, Any]) -> None:
    path = registry_path(workspace)
    if path.exists() and (not path.is_file() or path.is_symlink()):
        raise StyleProfileError("style profile registry is unsafe")
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(canonical_json(event) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def begin_style_transaction(
    workspace: Path,
    *,
    profile_text: str,
    metadata_text: str,
    event: Dict[str, Any],
) -> None:
    path = transaction_path(workspace)
    if path.exists() or path.is_symlink():
        raise StyleProfileError("style profile transaction already exists")
    validate_event(event, "style profile transaction event")
    current_path = workspace / "profile/style-profile.md"
    if not current_path.is_file() or current_path.is_symlink():
        raise StyleProfileError("profile/style-profile.md is missing or unsafe")
    current_before_sha256 = sha256_text(current_path.read_text(encoding="utf-8"))
    journal = {
        "schema_version": SCHEMA_VERSION,
        "operation": "save_style_profile",
        "request_id": event["request_id"],
        "payload_sha256": event["payload_sha256"],
        "revision": event["revision"],
        "current_before_sha256": current_before_sha256,
        "profile_path": event["profile_path"],
        "profile_sha256": event["profile_sha256"],
        "profile_text": profile_text,
        "metadata_path": event["metadata_path"],
        "metadata_sha256": event["metadata_sha256"],
        "metadata_text": metadata_text,
        "event": event,
    }
    write_new_text(path, json_text(journal))


def _load_style_transaction(workspace: Path) -> Optional[Dict[str, Any]]:
    path = transaction_path(workspace)
    if not path.exists():
        return None
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise StyleProfileError("style profile transaction journal is unsafe")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StyleProfileError("style profile transaction journal is invalid") from exc
    journal = require_object(value, "style profile transaction")
    check_exact_keys(
        journal,
        label="style profile transaction",
        expected=TRANSACTION_KEYS,
    )
    if journal.get("schema_version") != SCHEMA_VERSION:
        raise StyleProfileError("style profile transaction schema_version is invalid")
    if journal.get("operation") != "save_style_profile":
        raise StyleProfileError("style profile transaction operation is invalid")
    event = require_object(journal.get("event"), "style profile transaction event")
    validate_event(event, "style profile transaction event")
    for field in (
        "request_id",
        "payload_sha256",
        "revision",
        "profile_path",
        "profile_sha256",
        "metadata_path",
        "metadata_sha256",
    ):
        if journal.get(field) != event.get(field):
            raise StyleProfileError(
                f"style profile transaction {field} does not match event"
            )
    current_before_hash = journal.get("current_before_sha256")
    if (
        not isinstance(current_before_hash, str)
        or HASH_PATTERN.fullmatch(current_before_hash) is None
    ):
        raise StyleProfileError(
            "style profile transaction current_before_sha256 is invalid"
        )
    profile_text = journal.get("profile_text")
    metadata_text = journal.get("metadata_text")
    if not isinstance(profile_text, str) or not isinstance(metadata_text, str):
        raise StyleProfileError("style profile transaction content is invalid")
    if sha256_text(profile_text) != event["profile_sha256"]:
        raise StyleProfileError("style profile transaction profile hash does not match")
    if sha256_text(metadata_text) != event["metadata_sha256"]:
        raise StyleProfileError("style profile transaction metadata hash does not match")
    try:
        metadata = require_object(
            json.loads(metadata_text), "style profile transaction metadata"
        )
    except json.JSONDecodeError as exc:
        raise StyleProfileError("style profile transaction metadata is invalid") from exc
    config = metadata_to_config(metadata, "style profile transaction metadata")
    if render_profile(config) != profile_text:
        raise StyleProfileError("style profile transaction profile does not match metadata")
    expected_event = build_event(metadata, event["metadata_path"], event["metadata_sha256"])
    if expected_event != event:
        raise StyleProfileError("style profile transaction event does not match metadata")
    revision = event["revision"]
    suffix = f"style-profile-r{revision:03d}"
    if event["profile_path"] != f"profile/style-profile-history/{suffix}.md":
        raise StyleProfileError("style profile transaction profile path is invalid")
    if event["metadata_path"] != f"profile/style-profile-history/{suffix}.json":
        raise StyleProfileError("style profile transaction metadata path is invalid")
    return journal


def _ensure_transaction_file(path: Path, content: str, expected_hash: str) -> None:
    if path.exists() or path.is_symlink():
        if not path.is_file() or path.is_symlink():
            raise StyleProfileError("style profile transaction target is unsafe")
        if sha256_text(path.read_text(encoding="utf-8")) != expected_hash:
            raise StyleProfileError("style profile transaction target conflicts with journal")
        return
    write_new_text(path, content)


def recover_style_transaction(workspace: Path) -> Optional[Dict[str, Any]]:
    journal = _load_style_transaction(workspace)
    if journal is None:
        return None
    event = journal["event"]
    current_path = workspace / "profile/style-profile.md"
    if not current_path.is_file() or current_path.is_symlink():
        raise StyleProfileError("profile/style-profile.md is missing or unsafe")
    current_hash = sha256_text(current_path.read_text(encoding="utf-8"))
    allowed_current_hashes = {
        journal["current_before_sha256"],
        event["profile_sha256"],
    }
    if current_hash not in allowed_current_hashes:
        raise StyleProfileError(
            "style profile transaction conflicts with current profile"
        )

    events = load_events(workspace)
    revision = event["revision"]
    if len(events) < revision - 1:
        raise StyleProfileError("style profile transaction has a registry revision gap")
    if len(events) > revision:
        raise StyleProfileError(
            "style profile transaction conflicts with a newer registry revision"
        )
    if revision > 1:
        previous_event = events[revision - 2]
        if previous_event.get("profile_sha256") != journal["current_before_sha256"]:
            raise StyleProfileError(
                "style profile transaction previous current hash does not match registry"
            )

    profile_path = workspace / event["profile_path"]
    metadata_path = workspace / event["metadata_path"]
    _ensure_transaction_file(
        profile_path,
        journal["profile_text"],
        event["profile_sha256"],
    )
    _ensure_transaction_file(
        metadata_path,
        journal["metadata_text"],
        event["metadata_sha256"],
    )

    if len(events) == revision - 1:
        append_event(workspace, event)
    elif events[revision - 1] != event:
        raise StyleProfileError("style profile transaction conflicts with registry")

    if current_hash != event["profile_sha256"]:
        replace_current(current_path, journal["profile_text"])
    path = transaction_path(workspace)
    path.unlink()
    return event
