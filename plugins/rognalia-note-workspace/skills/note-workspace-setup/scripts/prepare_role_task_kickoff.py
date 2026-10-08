#!/usr/bin/env python3
"""Build one role-task kickoff challenge without creating or messaging a task."""

from __future__ import annotations

import argparse
import hashlib
import json
import secrets
import sys
from pathlib import Path
from typing import Optional

from task_binding_common import (
    PRIMARY_ROLES_BY_MODE,
    TaskBindingError,
    atomic_write_json,
    challenge_path,
    exclusive_lock,
    parse_timestamp,
    resolve_workspace,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Prepare a host-readback kickoff prompt for one user-visible task."
    )
    parser.add_argument("workspace", help="Absolute path to the user workspace")
    parser.add_argument(
        "--role",
        required=True,
        choices=("strategy", "tracker", "writer", "image", "diary", "compact"),
    )
    parser.add_argument("--task-id", required=True, help="Task ID read back from the host")
    parser.add_argument("--host-id", required=True, help="Host ID read back from the host")
    parser.add_argument("--slot", default="primary", help="primary or approved extra image slot")
    parser.add_argument(
        "--binding-origin",
        required=True,
        choices=("reused_setup", "created"),
    )
    parser.add_argument("--timestamp", help="ISO 8601 challenge issue time override")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace, manifest, settings = resolve_workspace(args.workspace)
        mode = settings["task_topology"]["mode"]
        generation = settings["task_topology"]["binding_generation"]
        if args.slot != "primary" and not (
            args.role == "image" and args.slot.startswith("extra-")
        ):
            raise TaskBindingError("only image may use an approved extra slot")
        if args.slot == "primary":
            if args.role not in PRIMARY_ROLES_BY_MODE[mode]:
                raise TaskBindingError(f"{mode} requires a matching primary role")
        if args.binding_origin == "reused_setup" and not (
            args.slot == "primary" and args.role in {"strategy", "compact"}
        ):
            raise TaskBindingError(
                "only a primary strategy or compact task may reuse setup"
            )
        standing_path = workspace / "profile/standing-instructions.json"
        if not standing_path.is_file() or standing_path.is_symlink():
            raise TaskBindingError("standing instructions state is missing or unsafe")
        standing = json.loads(standing_path.read_text(encoding="utf-8"))
        revision = standing.get("revision")
        if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
            raise TaskBindingError("standing instructions revision is invalid")
        task_id = args.task_id.strip()
        if not task_id or "\n" in task_id or "\r" in task_id:
            raise TaskBindingError("task ID must be one-line text")
        host_id = args.host_id.strip()
        if not host_id or "\n" in host_id or "\r" in host_id:
            raise TaskBindingError("host ID must be one-line text")
        title = settings["task_names"][args.role]
        issued_at, _ = parse_timestamp(args.timestamp)
        nonce = "ready-" + secrets.token_hex(16)
        expected = {
            "nonce": nonce,
            "workspace_id": manifest["workspace_id"],
            "workspace_path": str(workspace),
            "role": args.role,
            "task_id": task_id,
            "host_id": host_id,
            "task_title": title,
            "standing_instructions_revision": revision,
        }
        initial_paths = []
        start_here_path = workspace / "START_HERE.md"
        if start_here_path.is_symlink() or (
            start_here_path.exists() and not start_here_path.is_file()
        ):
            raise TaskBindingError("START_HERE.md is unsafe")
        if start_here_path.is_file():
            initial_paths.append(start_here_path)
        elif manifest.get("generator_version") != "0.3.0-dev":
            raise TaskBindingError("START_HERE.md is required for this workspace")
        initial_paths.extend(
            (
                workspace / "STUDIO.md",
                workspace / "strategy/operating-settings.json",
                workspace / "profile/standing-instructions.md",
                workspace / "strategy/role-task-plan.md",
            )
        )
        initial_files = "、".join(str(path) for path in initial_paths)
        kickoff = (
            f"あなたは{title}の担当です。最初に{initial_files}を読み、"
            "担当範囲と担当外を確認してください。"
            "担当の処理にはnote Workspaceの同梱Skillを使います。"
            "Plugin導入ではrognalia-note-workspaceがこのタスクで有効であり、"
            "必要なSkillを参照できることを確認してください。"
            "note Studio mini等の同名Skillへ切り替えないでください。"
            "Skill単独導入の場合は同じ配布元のSkillを確認します。"
            "必要なSkillを参照できない時はREADY_RECEIPTを返さず、"
            "有効化に必要な次の一手だけを伝えてください。"
            "会話だけを正本にせず、永続情報はworkspaceへ保存してください。"
            "利用者へ、自分が何を支えるか、普段このタスクを開く必要があるか、"
            "最初の話しかけ方の例を短く案内し、"
            "最後の一行に、次のREADY_RECEIPTを値を変えず返してください: "
            "READY_RECEIPT "
            + json.dumps(
                expected,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        kickoff_sha256 = hashlib.sha256(kickoff.encode("utf-8")).hexdigest()
        challenge = {
            "schema_version": 1,
            "status": "issued",
            "ready_nonce": nonce,
            "workspace_id": manifest["workspace_id"],
            "task_mode": mode,
            "binding_generation": generation,
            "role": args.role,
            "slot": args.slot,
            "task_id": task_id,
            "host_id": host_id,
            "task_title": title,
            "binding_origin": args.binding_origin,
            "standing_instructions_revision": revision,
            "issued_at": issued_at,
            "kickoff_message_sha256": kickoff_sha256,
            "host_evidence_sha256": None,
            "challenge_proof_sha256": None,
            "verified_at": None,
            "consumed_at": None,
            "consumed_event_id": None,
        }
        state_path = challenge_path(workspace, nonce)
        with exclusive_lock(workspace / "strategy/.task-binding.lock", issued_at):
            atomic_write_json(state_path, challenge, create=True)
        print(
            json.dumps(
                {
                    "task_mode": mode,
                    "binding_generation": generation,
                    "binding_origin": args.binding_origin,
                    "issued_at": issued_at,
                    "kickoff_message_sha256": kickoff_sha256,
                    "kickoff": kickoff,
                    "expected_ready_receipt": expected,
                    "challenge_path": state_path.relative_to(workspace).as_posix(),
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
