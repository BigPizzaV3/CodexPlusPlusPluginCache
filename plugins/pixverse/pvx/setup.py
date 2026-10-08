from __future__ import annotations

import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import __version__
from .compatibility import (
    PIXVERSE_CLI_MINIMUM_VERSION,
    pixverse_cli_artifact_sha256,
    pixverse_cli_channel,
    pixverse_cli_effective_install_spec,
    pixverse_cli_executable,
    pixverse_cli_installed_version,
    pixverse_cli_node_requirement,
    pixverse_cli_runtime_root,
    pixverse_cli_source,
    pixverse_cli_version_supported,
)
from .internal_cli import ONLINE_CLI_CHANNEL, node_version_satisfies
from .shell import run, which
from .python_dependencies import pillow_status
from .skills import list_skills, validate_skills
from .state import local_data_home, plugin_root, pvx_command, repo_root, utc_now


SETUP_GATE_EXIT = 3
SETUP_STATE_FILENAME = "setup-state.json"
INTERNAL_SETUP_STATE_FILENAME = "setup-state.internal.json"
REQUIRED_BINARIES = ("node", "npm", "pixverse", "ffmpeg", "ffprobe")
SETUP_CACHE_STALE_SECONDS = 24 * 60 * 60


def setup_state_path() -> Path:
    filename = (
        INTERNAL_SETUP_STATE_FILENAME
        if pixverse_cli_channel() != ONLINE_CLI_CHANNEL
        else SETUP_STATE_FILENAME
    )
    return local_data_home() / filename


def run_setup_doctor() -> dict[str, Any]:
    checks: dict[str, Any] = {}
    workspace = repo_root()
    report: dict[str, Any] = {
        "pixverse_agent_plugin": __version__,
        "checked_at": utc_now(),
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "root": str(workspace),
        "workspace_root": str(workspace),
        "plugin_root": str(plugin_root()),
        "pixverse_cli_channel": pixverse_cli_channel(),
        "pixverse_cli_source": pixverse_cli_source(),
        "pixverse_cli_artifact_sha256": pixverse_cli_artifact_sha256(),
        "pixverse_cli_minimum": PIXVERSE_CLI_MINIMUM_VERSION,
        "pixverse_cli_install_spec": pixverse_cli_effective_install_spec(),
        "pixverse_cli_node_requirement": pixverse_cli_node_requirement(),
        "pixverse_cli_runtime": str(pixverse_cli_runtime_root()),
        "setup_state_path": str(setup_state_path()),
        "checks": checks,
    }

    for binary, args in {
        "node": ["node", "--version"],
        "npm": ["npm", "--version"],
        "pixverse": ["pixverse", "--version"],
        "ffmpeg": ["ffmpeg", "-version"],
        "ffprobe": ["ffprobe", "-version"],
    }.items():
        checks[binary] = _binary_check(binary, args)

    checks["pillow"] = pillow_status()

    if which("pixverse"):
        try:
            result = run(["pixverse", "auth", "status", "--json"], timeout=30)
            auth_payload = _parse_json_object(result.stdout)
            checks["pixverse_auth"] = {
                "ok": result.ok,
                "authenticated": bool(auth_payload.get("authenticated")),
                "stdout": _redact_json_stdout(result.stdout, {"email", "nickname", "access_key", "token"}),
                "stderr": _truncate(result.stderr, 800),
            }
        except subprocess.TimeoutExpired as exc:
            checks["pixverse_auth"] = {
                "ok": False,
                "authenticated": False,
                "error": "timeout",
                "timeout_seconds": exc.timeout,
                "stdout": "",
                "stderr": "PixVerse auth status timed out; login state is unknown.",
            }
        try:
            slots = run(["pixverse", "account", "slots", "--json"], timeout=30)
            checks["pixverse_slots"] = {
                "ok": slots.ok,
                "stdout": _truncate(slots.stdout, 800),
                "stderr": _truncate(slots.stderr, 800),
            }
        except subprocess.TimeoutExpired as exc:
            checks["pixverse_slots"] = {
                "ok": False,
                "error": "timeout",
                "timeout_seconds": exc.timeout,
                "stdout": "",
                "stderr": "PixVerse slot status timed out; capacity is unknown.",
            }

    skill_issues = validate_skills()
    public_skills = list_skills()
    all_skills = list_skills(include_internal=True)
    checks["skills"] = {
        "count": len(public_skills),
        "public_count": len(public_skills),
        "internal_count": max(0, len(all_skills) - len(public_skills)),
        "ok": not skill_issues,
        "issues": skill_issues,
    }

    report["ready"] = setup_ready(checks)
    report["missing"] = missing_setup_items(checks)
    report["next_steps"] = setup_next_steps(checks)
    report["status"] = "ready" if report["ready"] else "blocked"
    _annotate_cache_age(report)
    write_setup_state(report)
    return report


def setup_status() -> dict[str, Any]:
    path = setup_state_path()
    if not path.exists():
        return {
            "ready": False,
            "status": "missing",
            "pixverse_cli_channel": pixverse_cli_channel(),
            "pixverse_cli_source": pixverse_cli_source(),
            "pixverse_cli_install_spec": pixverse_cli_effective_install_spec(),
            "pixverse_cli_node_requirement": pixverse_cli_node_requirement(),
            "setup_state_path": str(path),
            "message": "PixVerse setup has not been checked on this machine yet.",
            "missing": ["setup_state"],
            "next_steps": [f"{pvx_command()} doctor"],
        }
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {
            "ready": False,
            "status": "invalid",
            "setup_state_path": str(path),
            "message": "PixVerse setup state file is not valid JSON.",
            "missing": ["setup_state_invalid"],
            "next_steps": [f"{pvx_command()} doctor"],
        }
    if not isinstance(payload, dict):
        return {
            "ready": False,
            "status": "invalid",
            "setup_state_path": str(path),
            "message": "PixVerse setup state file must contain a JSON object.",
            "missing": ["setup_state_invalid"],
            "next_steps": [f"{pvx_command()} doctor"],
        }
    payload.setdefault("setup_state_path", str(path))
    checks = payload.get("checks")
    if isinstance(checks, dict):
        cached_ready = payload.get("ready")
        payload["ready"] = setup_ready(checks) if cached_ready is None else bool(cached_ready) and setup_ready(checks)
        payload["missing"] = missing_setup_items(checks)
        payload["next_steps"] = setup_next_steps(checks)
        contract_current = (
            payload.get("pixverse_cli_minimum") == PIXVERSE_CLI_MINIMUM_VERSION
            and payload.get("pixverse_cli_node_requirement") == pixverse_cli_node_requirement()
            and payload.get("pixverse_cli_channel") == pixverse_cli_channel()
            and payload.get("pixverse_cli_source") == pixverse_cli_source()
            and payload.get("pixverse_cli_install_spec") == pixverse_cli_effective_install_spec()
            and payload.get("pixverse_cli_artifact_sha256") == pixverse_cli_artifact_sha256()
            and payload.get("pixverse_cli_runtime") == str(pixverse_cli_runtime_root())
        )
        if not contract_current:
            payload["ready"] = False
            payload["missing"] = _dedupe(["pixverse_cli_contract_changed", *payload["missing"]])
            payload["next_steps"] = _dedupe(
                [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor", *payload["next_steps"]]
            )
    else:
        payload["ready"] = False
        payload["missing"] = ["checks_missing"]
        payload["next_steps"] = [f"{pvx_command()} doctor"]
    payload["status"] = "ready" if payload.get("ready") else "blocked"
    _annotate_cache_age(payload)
    return payload


def setup_blocker(action: str) -> dict[str, Any] | None:
    status = setup_status()
    if status.get("ready"):
        return None
    missing = status.get("missing") if isinstance(status.get("missing"), list) else []
    login_missing = "pixverse_login" in missing or "pixverse_auth" in missing
    blocker: dict[str, Any] = {
        "error": "setup_required",
        "action": action,
        "generation_started": False,
        "message": (
            "PixVerse CLI is not logged in, so no paid generation was attempted. Run the login command; "
            "it opens PixVerse's browser OAuth flow. Complete authorization there, then run doctor and preflight again."
            if login_missing
            else "PixVerse setup is not ready. Complete the reported dependency/readiness steps before paid generation."
        ),
        "setup": compact_setup_status(status),
    }
    if login_missing:
        blocker.update(
            {
                "login_command": f"{pvx_command()} pixverse auth login",
                "auth_status_command": f"{pvx_command()} pixverse auth status --json",
                "doctor_command": f"{pvx_command()} doctor",
                "browser_flow": "PixVerse OAuth device authorization",
            }
        )
    return blocker


def write_setup_state(payload: dict[str, Any]) -> Path:
    path = setup_state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    return path


def compact_setup_status(status: dict[str, Any]) -> dict[str, Any]:
    compact = {
        "ready": bool(status.get("ready")),
        "status": status.get("status", "blocked"),
        "checked_at": status.get("checked_at", ""),
        "pixverse_cli_channel": status.get("pixverse_cli_channel", pixverse_cli_channel()),
        "pixverse_cli_source": status.get("pixverse_cli_source", pixverse_cli_source()),
        "pixverse_cli_install_spec": status.get(
            "pixverse_cli_install_spec", pixverse_cli_effective_install_spec()
        ),
        "pixverse_cli_node_requirement": status.get(
            "pixverse_cli_node_requirement", pixverse_cli_node_requirement()
        ),
        "setup_state_path": status.get("setup_state_path", str(setup_state_path())),
        "missing": status.get("missing", []),
        "next_steps": status.get("next_steps", [f"{pvx_command()} doctor"]),
    }
    if "cache_stale" in status:
        compact["cache_stale"] = status.get("cache_stale")
    if "refresh_command" in status:
        compact["refresh_command"] = status.get("refresh_command")
    return compact


def setup_ready(checks: dict[str, Any]) -> bool:
    if "pillow" in checks and not checks["pillow"].get("ok"):
        return False
    for key in REQUIRED_BINARIES:
        item = checks.get(key)
        if not isinstance(item, dict) or not item.get("found") or not item.get("ok"):
            return False
    node = checks.get("node")
    if isinstance(node, dict) and node.get("version_ok") is False:
        return False
    pixverse = checks.get("pixverse")
    if not isinstance(pixverse, dict) or pixverse.get("version_ok") is not True:
        return False
    auth = checks.get("pixverse_auth")
    if not isinstance(auth, dict) or not auth.get("ok") or not auth.get("authenticated"):
        return False
    slots = checks.get("pixverse_slots")
    if not isinstance(slots, dict) or not slots.get("ok"):
        return False
    skills = checks.get("skills")
    if isinstance(skills, dict) and not skills.get("ok"):
        return False
    return True


def missing_setup_items(checks: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if "pillow" in checks and not checks["pillow"].get("ok"):
        missing.append("pillow")
    for key in REQUIRED_BINARIES:
        item = checks.get(key)
        if not isinstance(item, dict) or not item.get("found"):
            missing.append(key)
            continue
        if not item.get("ok"):
            missing.append(f"{key}_check_failed")
    node = checks.get("node")
    if isinstance(node, dict) and node.get("version_ok") is False:
        missing.append("node_version_required")
    pixverse = checks.get("pixverse")
    if isinstance(pixverse, dict) and pixverse.get("found") and pixverse.get("version_ok") is not True:
        missing.append("pixverse_cli_below_minimum")
    auth = checks.get("pixverse_auth")
    if not isinstance(auth, dict):
        missing.append("pixverse_auth")
    elif not auth.get("ok") or not auth.get("authenticated"):
        missing.append("pixverse_login")
    slots = checks.get("pixverse_slots")
    if not isinstance(slots, dict) or not slots.get("ok"):
        missing.append("pixverse_slots")
    skills = checks.get("skills")
    if isinstance(skills, dict) and not skills.get("ok"):
        missing.append("skills_valid")
    return missing


def setup_next_steps(checks: dict[str, Any]) -> list[str]:
    missing = set(missing_setup_items(checks))
    steps: list[str] = []
    if any(item in missing for item in ("node", "npm", "pixverse", "ffmpeg", "ffprobe", "pillow")) or (
        "pixverse_cli_below_minimum" in missing
    ):
        steps.append(f"{pvx_command()} bootstrap --yes")
    if "node_version_required" in missing:
        steps.append(
            f"Install Node.js {pixverse_cli_node_requirement()} with your package manager"
        )
    if "pixverse" not in missing and ("pixverse_login" in missing or "pixverse_auth" in missing):
        steps.append(f"{pvx_command()} pixverse auth login")
    if "skills_valid" in missing:
        steps.append(f"{pvx_command()} skills validate")
    if missing:
        steps.append(f"{pvx_command()} doctor")
    return _dedupe(steps)


def _binary_check(binary: str, args: list[str]) -> dict[str, Any]:
    path = which(binary)
    item: dict[str, Any] = {"found": bool(path), "path": path or ""}
    if binary == "pixverse":
        item["minimum_version"] = PIXVERSE_CLI_MINIMUM_VERSION
        item["channel"] = pixverse_cli_channel()
        item["source"] = pixverse_cli_source()
        item["install_spec"] = pixverse_cli_effective_install_spec()
        item["artifact_sha256"] = pixverse_cli_artifact_sha256()
        item["runtime"] = str(pixverse_cli_runtime_root())
        if not path and pixverse_cli_executable().is_file():
            item.update(
                {
                    "found": True,
                    "path": str(pixverse_cli_executable()),
                    "ok": False,
                    "version": pixverse_cli_installed_version(),
                    "version_ok": False,
                }
            )
            return item
    if not path:
        item["ok"] = False
        if binary == "pixverse":
            item["version_ok"] = False
        return item
    try:
        result = run(args, timeout=20)
    except subprocess.TimeoutExpired as exc:
        item.update(
            {
                "ok": False,
                "version": "",
                "error": "timeout",
                "timeout_seconds": exc.timeout,
            }
        )
        if binary == "node":
            item["version_ok"] = False
        return item
    version = (result.stdout or result.stderr).splitlines()[0] if (result.stdout or result.stderr) else ""
    item["ok"] = result.ok
    item["version"] = version
    if binary == "node":
        item["minimum_version"] = pixverse_cli_node_requirement()
        item["version_ok"] = _node_version_ok(version)
    elif binary == "pixverse":
        item["version_ok"] = result.ok and pixverse_cli_version_supported(version)
    return item


def _node_version_ok(version: str) -> bool:
    return node_version_satisfies(version, pixverse_cli_node_requirement())


def _dedupe(values: list[str]) -> list[str]:
    out: list[str] = []
    for value in values:
        if value not in out:
            out.append(value)
    return out


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 3] + "..."


def _redact_json_stdout(value: str, keys: set[str]) -> str:
    payload = _parse_json_object(value)
    if not isinstance(payload, dict):
        return _truncate(value, 800)
    redacted = dict(payload)
    for key in keys:
        if key in redacted and redacted[key]:
            redacted[key] = "[redacted]"
    return json.dumps(redacted, ensure_ascii=False, indent=2)


def _parse_json_object(value: str) -> dict[str, Any]:
    try:
        payload = json.loads(value) if value.strip() else {}
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _annotate_cache_age(payload: dict[str, Any]) -> None:
    age = _cache_age_seconds(str(payload.get("checked_at") or ""))
    if age is None:
        return
    payload["cache_age_seconds"] = age
    payload["cache_stale"] = age > SETUP_CACHE_STALE_SECONDS
    if payload["cache_stale"]:
        payload["refresh_command"] = f"{pvx_command()} setup refresh"


def _cache_age_seconds(checked_at: str) -> int | None:
    if not checked_at:
        return None
    try:
        parsed = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)
    return max(0, int(delta.total_seconds()))
