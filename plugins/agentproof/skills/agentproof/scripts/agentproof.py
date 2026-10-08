#!/usr/bin/env python3
"""Fixed-request launcher for the AgentProof Codex skill."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import traceback
from pathlib import Path
from typing import Any

# Keep the installed plugin tree immutable even if a host omits Python's -B flag.
sys.dont_write_bytecode = True

from agentproof_runtime.capture import (
    CodexCaptureError,
    capture_codex_session,
    resolve_repository_root,
)
from agentproof_runtime.receipt import ReceiptLoadError, load_canonical_receipt
from agentproof_runtime.repository import (
    RepositoryVerifyError,
    verify_repository_state,
)


REQUEST_PATH = Path(".agentproof/request.json")
RECEIPT_PATH = Path(".agentproof/agent-session.json")
MAX_REQUEST_BYTES = 128 * 1024
MAX_PROMPT_BYTES = 64 * 1024
MODEL_RE = re.compile(r"^[A-Za-z0-9._:/+-]{1,128}$")
LIMITS = [
    "cooperative_operator_side_capture",
    "observed_events_may_be_incomplete",
    "integrity_does_not_establish_truth_or_quality",
    "no_identity_compliance_or_economic_authority",
    "no_independent_public_timestamp",
]


class RequestError(RuntimeError):
    pass


def _read_fd_limited(fd: int, limit: int) -> bytes:
    chunks: list[bytes] = []
    remaining = limit + 1
    while remaining:
        chunk = os.read(fd, min(64 * 1024, remaining))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _require_git_root() -> Path:
    current = Path.cwd().resolve()
    root = resolve_repository_root(current)
    if current != root:
        raise RequestError("run_from_git_repository_root")
    return root


def _ensure_private_control_directory(repo_root: Path) -> Path:
    control = repo_root / ".agentproof"
    try:
        info = control.lstat()
    except FileNotFoundError:
        control.mkdir(mode=0o700)
        info = control.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        raise RequestError("agentproof_control_directory_unsafe")
    if hasattr(os, "getuid") and info.st_uid != os.getuid():
        raise RequestError("agentproof_control_directory_wrong_owner")
    control.chmod(0o700)
    return control


def _require_fixed_request_argument(value: str) -> Path:
    if value != REQUEST_PATH.as_posix():
        raise RequestError("request_path_must_be_.agentproof/request.json")
    return REQUEST_PATH


def _read_and_consume_request(repo_root: Path, relative_path: Path) -> dict[str, Any]:
    path = repo_root / relative_path
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(path, flags)
    except OSError as exc:
        raise RequestError("request_not_safely_readable") from exc

    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise RequestError("request_must_be_regular_file")
        if info.st_nlink != 1:
            raise RequestError("request_hardlink_forbidden")
        if hasattr(os, "getuid") and info.st_uid != os.getuid():
            raise RequestError("request_wrong_owner")
        if info.st_size > MAX_REQUEST_BYTES:
            raise RequestError("request_too_large")
        raw = _read_fd_limited(fd, MAX_REQUEST_BYTES)
        if len(raw) > MAX_REQUEST_BYTES:
            raise RequestError("request_too_large")
        identity = (info.st_dev, info.st_ino)
    finally:
        os.close(fd)

    try:
        current = path.lstat()
    except FileNotFoundError as exc:
        raise RequestError("request_changed_during_read") from exc
    if (
        stat.S_ISLNK(current.st_mode)
        or not stat.S_ISREG(current.st_mode)
        or current.st_nlink != 1
        or (current.st_dev, current.st_ino) != identity
    ):
        raise RequestError("request_changed_during_read")
    path.unlink()

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RequestError("request_not_valid_utf8_json") from exc
    if not isinstance(payload, dict):
        raise RequestError("request_must_be_object")
    return payload


def _validate_request(payload: dict[str, Any]) -> dict[str, Any]:
    action = payload.get("action")
    if action == "capture":
        expected = {"action", "model", "prompt", "sandbox"}
        if set(payload) != expected:
            raise RequestError("capture_request_fields_invalid")
        model = payload.get("model")
        prompt = payload.get("prompt")
        sandbox = payload.get("sandbox")
        if not isinstance(model, str) or MODEL_RE.fullmatch(model) is None:
            raise RequestError("model_identifier_invalid")
        if (
            not isinstance(prompt, str)
            or not prompt.strip()
            or len(prompt.encode("utf-8")) > MAX_PROMPT_BYTES
        ):
            raise RequestError("prompt_invalid")
        if sandbox not in {"read-only", "workspace-write"}:
            raise RequestError("sandbox_invalid")
        return payload
    if action == "verify":
        if set(payload) != {"action"}:
            raise RequestError("verify_request_fields_invalid")
        return payload
    raise RequestError("action_unsupported")


def _require_new_output(path: Path, code: str) -> None:
    try:
        path.lstat()
    except FileNotFoundError:
        return
    raise RequestError(code)


def _require_receipt(path: Path) -> None:
    try:
        info = path.lstat()
    except FileNotFoundError as exc:
        raise RequestError("receipt_missing") from exc
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise RequestError("receipt_must_be_regular_non_symlink")
    if info.st_nlink != 1:
        raise RequestError("receipt_hardlink_forbidden")
    if hasattr(os, "getuid") and info.st_uid != os.getuid():
        raise RequestError("receipt_wrong_owner")


def _capture(repo_root: Path, request: dict[str, Any]) -> dict[str, Any]:
    receipt_path = repo_root / RECEIPT_PATH
    _require_new_output(receipt_path, "receipt_already_exists")
    receipt = capture_codex_session(
        repo=repo_root,
        prompt=request["prompt"],
        output_path=receipt_path,
        model=request["model"],
        sandbox=request["sandbox"],
    )
    return {
        "action": "capture",
        "result": "RECEIPT_CREATED",
        "receipt": RECEIPT_PATH.as_posix(),
        "session_id": receipt["session_id"],
        "event_count": receipt["event_count"],
        "chain_head_sha256": receipt["chain_head_sha256"],
        "limits": LIMITS,
    }


def _verify(repo_root: Path) -> tuple[dict[str, Any], bool]:
    receipt_path = repo_root / RECEIPT_PATH
    _require_receipt(receipt_path)
    receipt, _ = load_canonical_receipt(receipt_path)
    repository = verify_repository_state(receipt, repo_root)
    result = {
        "action": "verify",
        "result": repository["result"],
        "receipt_valid": True,
        "repository": {
            key: value
            for key, value in repository.items()
            if key != "repository_root"
        },
        "limits": LIMITS,
    }
    return result, bool(repository["valid"])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="agentproof")
    parser.add_argument("--request", required=True)
    return parser


def _emit_error(error: str, **details: Any) -> int:
    print(
        json.dumps(
            {
                "result": "ERROR",
                "error": error,
                **details,
                "limits": LIMITS,
            },
            sort_keys=True,
        ),
        file=sys.stderr,
    )
    return 1


def _traceback_sha256(exc: Exception) -> str:
    rendered = "".join(
        traceback.TracebackException(
            type(exc),
            exc,
            exc.__traceback__,
            capture_locals=False,
        ).format()
    ).encode("utf-8")
    return hashlib.sha256(rendered).hexdigest()


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        repo_root = _require_git_root()
        _ensure_private_control_directory(repo_root)
        request_path = _require_fixed_request_argument(args.request)
        request = _validate_request(_read_and_consume_request(repo_root, request_path))
        if request["action"] == "capture":
            result = _capture(repo_root, request)
            status = 0
        else:
            result, valid = _verify(repo_root)
            status = 0 if valid else 1
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return status
    except (
        CodexCaptureError,
        ReceiptLoadError,
        RepositoryVerifyError,
        RequestError,
    ) as exc:
        return _emit_error(str(exc))
    except Exception as exc:
        return _emit_error(
            "unexpected_runtime_error",
            exception_type=type(exc).__name__,
            traceback_sha256=_traceback_sha256(exc),
        )


if __name__ == "__main__":
    raise SystemExit(main())
