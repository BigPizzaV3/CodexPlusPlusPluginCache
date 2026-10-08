#!/usr/bin/env python3
"""Read-only compatibility check for the installed Codex Coordinator package."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


EXPECTED_CAPABILITIES = {
    "corePurpose": "repository-task-boundary-visibility",
    "repositoryLifecycle": "explicit-opt-in",
    "projectLifecycleTool": "dry-run-first-init-deactivate-migrate-reactivate-purge",
    "defaultExecution": "one-native-task",
    "nativeTaskAuthority": "execution-messaging-transcript",
    "claimOwnership": "per-task-json-record",
    "claimConflictCheck": "advisory-path-overlap-exclusive-action-only",
    "activeTaskLimit": "three-default-twelve-hard-user-override",
    "taskCreation": "reuse-first-then-local-two-or-three-verticals",
    "taskReuse": "related-local-task-before-create",
    "goalCoordinator": "user-invoked-goal-scoped-on-demand",
    "goalCoordinationAction": "goal-coordination",
    "taskPlacement": "shared-primary-checkout-current-branch",
    "dependentParallelism": "durable-verticals-or-parent-owned-subagents",
    "messagePolicy": "coordinator-one-shot-assignment-and-sparse-peer-notices",
    "transcriptStorage": "none",
    "currentView": "generated-active-only-non-authoritative",
    "automaticFanIn": "none",
    "sessionStart": "marker-only-no-child-process",
    "stopGuard": "own-active-claim-one-shot-no-transcript",
    "doctor": "read-only-compatibility-reinstall",
    "externalWriteConsent": "exact-target-advance-notice",
    "staleClaimRecovery": "native-terminal-evidence",
    "stateTool": "scripts/coordination_state.py",
    "archivePolicy": "cold-compact-receipts",
    "gitWorkflow": "cooperative-exact-file-commits-shared-branch",
}


class CheckError(RuntimeError):
    """Raised for one deterministic package compatibility failure."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise CheckError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _json_object(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise CheckError(f"missing or unreadable file: {path.name}") from error
    if len(raw) > 131_072:
        raise CheckError(f"file is unexpectedly large: {path.name}")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise CheckError(f"invalid JSON: {path.name}") from error
    if not isinstance(value, dict):
        raise CheckError(f"JSON root is not an object: {path.name}")
    return value


def _text(path: Path) -> str:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise CheckError(f"missing or unreadable file: {path.name}") from error
    if len(raw) > 262_144:
        raise CheckError(f"file is unexpectedly large: {path.name}")
    try:
        return raw.decode("utf-8")
    except UnicodeError as error:
        raise CheckError(f"file is not UTF-8: {path.name}") from error


def _check_python(path: Path) -> None:
    source = _text(path)
    try:
        compile(source, str(path), "exec")
    except SyntaxError as error:
        raise CheckError(f"Python syntax is invalid: {path.name}:{error.lineno}") from error


def _check_skill(skill_root: Path) -> None:
    skill_path = skill_root / "SKILL.md"
    skill = _text(skill_path)
    if not skill.startswith("---\n") or "\nname: codex-coordinator\n" not in skill[:500]:
        raise CheckError("SKILL.md frontmatter is incompatible")
    if "task-boundary" not in skill[:800].casefold():
        raise CheckError("SKILL.md does not describe the boundary-board contract")
    resolved_root = skill_root.resolve(strict=True)
    for document in sorted(skill_root.rglob("*.md")):
        source = _text(document)
        links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", source)
        for link in links:
            if "://" in link or link.startswith("#"):
                continue
            target = (document.parent / link.split("#", 1)[0]).resolve(strict=False)
            try:
                target.relative_to(resolved_root)
            except ValueError as error:
                raise CheckError(
                    f"{document.name} link escapes the skill package: {link}"
                ) from error
            if not target.is_file():
                raise CheckError(f"{document.name} link is missing: {link}")


def _check_hook(plugin_root: Path) -> None:
    hooks = _json_object(plugin_root / "hooks" / "hooks.json")
    try:
        if set(hooks) != {"hooks"} or set(hooks["hooks"]) != {"SessionStart", "Stop"}:
            raise CheckError("hook registration contains unsupported events")
        entries = hooks["hooks"]["SessionStart"]
        if not isinstance(entries, list) or len(entries) != 1:
            raise CheckError("SessionStart must contain exactly one registration")
        entry = entries[0]
        if not isinstance(entry, dict) or set(entry) != {"matcher", "hooks"}:
            raise CheckError("SessionStart registration fields are incompatible")
        if entry["matcher"] != "startup|resume|clear|compact":
            raise CheckError("SessionStart matcher is incompatible")
        if not isinstance(entry["hooks"], list) or len(entry["hooks"]) != 1:
            raise CheckError("SessionStart must contain exactly one command")
        command_hook = entry["hooks"][0]
        if not isinstance(command_hook, dict):
            raise CheckError("SessionStart command is incompatible")
    except (KeyError, IndexError, TypeError) as error:
        raise CheckError("SessionStart hook registration is incompatible") from error
    expected_fields = {
        "type",
        "command",
        "commandWindows",
        "timeout",
        "statusMessage",
    }
    if set(command_hook) != expected_fields or command_hook.get("type") != "command":
        raise CheckError("SessionStart command fields are incompatible")
    expected = "scripts/codex_coordinator_session_start.py"
    if command_hook.get("command") != (
        'python3 -I "${PLUGIN_ROOT}/scripts/codex_coordinator_session_start.py"'
    ) or command_hook.get("commandWindows") != (
        'python -I "${PLUGIN_ROOT}/scripts/codex_coordinator_session_start.py"'
    ):
        raise CheckError("SessionStart must call the packaged marker-only hook directly")
    timeout = command_hook.get("timeout")
    if not isinstance(timeout, int) or isinstance(timeout, bool) or not 1 <= timeout <= 5:
        raise CheckError("SessionStart timeout must be between one and five seconds")
    _check_python(plugin_root / expected)

    try:
        stop_entries = hooks["hooks"]["Stop"]
        if not isinstance(stop_entries, list) or len(stop_entries) != 1:
            raise CheckError("Stop must contain exactly one registration")
        stop_entry = stop_entries[0]
        if not isinstance(stop_entry, dict) or set(stop_entry) != {"hooks"}:
            raise CheckError("Stop registration must not contain a matcher")
        if not isinstance(stop_entry["hooks"], list) or len(stop_entry["hooks"]) != 1:
            raise CheckError("Stop must contain exactly one command")
        stop_hook = stop_entry["hooks"][0]
        if not isinstance(stop_hook, dict):
            raise CheckError("Stop command is incompatible")
    except (KeyError, IndexError, TypeError) as error:
        raise CheckError("Stop hook registration is incompatible") from error
    stop_fields = {"type", "command", "commandWindows", "timeout"}
    if set(stop_hook) != stop_fields or stop_hook.get("type") != "command":
        raise CheckError("Stop command fields are incompatible")
    stop_script = "scripts/codex_coordinator_stop_guard.py"
    if stop_hook.get("command") != (
        'python3 -I "${PLUGIN_ROOT}/scripts/codex_coordinator_stop_guard.py"'
    ) or stop_hook.get("commandWindows") != (
        'python -I "${PLUGIN_ROOT}/scripts/codex_coordinator_stop_guard.py"'
    ):
        raise CheckError("Stop must call the packaged own-claim guard directly")
    stop_timeout = stop_hook.get("timeout")
    if (
        not isinstance(stop_timeout, int)
        or isinstance(stop_timeout, bool)
        or not 1 <= stop_timeout <= 5
    ):
        raise CheckError("Stop timeout must be between one and five seconds")
    _check_python(plugin_root / stop_script)


def check_package(plugin_root: Path) -> dict[str, Any]:
    root = plugin_root.expanduser().resolve(strict=False)
    findings: list[str] = []

    def attempt(label: str, action) -> None:
        try:
            action()
        except (CheckError, OSError) as error:
            findings.append(f"{label}: {error}")

    manifest: dict[str, Any] = {}

    def manifest_check() -> None:
        nonlocal manifest
        manifest = _json_object(root / ".codex-plugin" / "plugin.json")
        if manifest.get("name") != "codex-coordinator":
            raise CheckError("plugin name is incompatible")
        if not re.fullmatch(r"\d+\.\d+\.\d+", str(manifest.get("version", ""))):
            raise CheckError("plugin version is not semantic")

    attempt("manifest", manifest_check)

    def capabilities_check() -> None:
        capabilities = _json_object(
            root / "skills" / "codex-coordinator" / "capabilities.json"
        )
        if capabilities.get("contractVersion") != 28:
            raise CheckError("capability contract version must be 26")
        if capabilities.get("capabilities") != EXPECTED_CAPABILITIES:
            raise CheckError("capability contract fields do not match version 26")

    attempt("capabilities", capabilities_check)
    attempt("skill", lambda: _check_skill(root / "skills" / "codex-coordinator"))
    attempt("state_helper", lambda: _check_python(root / "skills" / "codex-coordinator" / "scripts" / "coordination_state.py"))
    attempt("project_lifecycle", lambda: _check_python(root / "scripts" / "codex_coordinator_project.py"))
    attempt("hook", lambda: _check_hook(root))

    healthy = not findings
    return {
        "status": "healthy" if healthy else "broken",
        "package": "codex-coordinator",
        "version": manifest.get("version") if isinstance(manifest.get("version"), str) else "unknown",
        "checks": 6,
        "failures": len(findings),
        "findings": findings,
        "recommendedAction": "none" if healthy else "update_or_reinstall",
        "message": (
            "Codex Coordinator package is compatible."
            if healthy
            else "Codex Coordinator is broken or outdated. Update or reinstall the plugin from its configured marketplace or source."
        ),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--plugin-root",
        "--source-plugin",
        dest="plugin_root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="installed plugin package to check",
    )
    parser.add_argument("--compact", action="store_true", help="omit detailed findings")
    parser.add_argument("--skill-root", help=argparse.SUPPRESS)
    parser.add_argument("--hook-path", help=argparse.SUPPRESS)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="run the read-only check")
    mode.add_argument("--apply", action="store_true", help="legacy repair mode; always rejected")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.apply:
        report = {
            "status": "broken",
            "package": "codex-coordinator",
            "failures": 1,
            "findings": ["In-place Doctor repair was removed."],
            "recommendedAction": "update_or_reinstall",
            "message": "Codex Coordinator is not self-repaired. Update or reinstall the plugin from its configured marketplace or source.",
        }
        if args.compact:
            report.pop("findings")
        print(json.dumps(report, indent=2))
        return 2

    report = check_package(args.plugin_root)
    if args.skill_root or args.hook_path:
        report["status"] = "broken"
        report["failures"] = int(report["failures"]) + 1
        report["recommendedAction"] = "update_or_reinstall"
        report["findings"].append(
            "Separate skill and hook repair targets are unsupported; check the installed plugin package."
        )
        report["message"] = (
            "Codex Coordinator is broken or outdated. Update or reinstall the plugin from its configured marketplace or source."
        )
    if args.compact:
        report.pop("findings", None)
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "healthy" else 1


if __name__ == "__main__":
    sys.exit(main())
