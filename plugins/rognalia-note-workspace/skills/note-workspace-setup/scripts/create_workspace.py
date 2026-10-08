#!/usr/bin/env python3
"""Create a validated local note Workspace without overwriting."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from workspace_common import (
    SetupConfigError,
    build_workspace_tree,
    load_setup_config,
    parse_timestamp,
    planned_relative_paths,
    validate_workspace,
    validate_workspace_id,
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _absolute_destination(raw: str) -> Path:
    entered = Path(raw).expanduser()
    if not entered.is_absolute():
        raise SetupConfigError("destination must be an absolute path")
    destination = entered.resolve()
    repository = REPOSITORY_ROOT.resolve()
    if _is_within(destination, repository):
        raise SetupConfigError("destination must be outside the source repository")
    if destination == Path(destination.anchor):
        raise SetupConfigError("destination must not be a filesystem root")
    return destination


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create a local note Workspace from approved setup JSON."
    )
    parser.add_argument("destination", help="Approved absolute path for the new workspace")
    parser.add_argument(
        "--config",
        required=True,
        help="Setup config JSON path, or - to read JSON from stdin",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the plan without writing anything",
    )
    parser.add_argument(
        "--create-parents",
        action="store_true",
        help="Create missing parent directories after their path is approved",
    )
    parser.add_argument(
        "--timestamp",
        help="ISO 8601 timestamp override for deterministic tests or migrations",
    )
    parser.add_argument(
        "--workspace-id",
        help="Workspace ID override for deterministic tests or migrations",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    staging: Optional[Path] = None
    try:
        config = load_setup_config(args.config)
        created_at, moment = parse_timestamp(args.timestamp)
        workspace_id = validate_workspace_id(
            args.workspace_id or f"nw-{uuid.uuid4().hex[:12]}"
        )
        destination = _absolute_destination(args.destination)

        if destination.exists():
            raise SetupConfigError("destination already exists; no files were changed")

        plan = {
            "status": "dry_run" if args.dry_run else "ready",
            "destination": str(destination),
            "workspace_id": workspace_id,
            "created_at": created_at,
            "planned_paths": planned_relative_paths(moment),
            "parent_exists": destination.parent.exists(),
            "parent_creation_required": not destination.parent.exists(),
            "create_parents_requested": args.create_parents,
            "external_actions": [],
        }
        if destination.parent.exists() and not destination.parent.is_dir():
            raise SetupConfigError("destination parent is not a directory")
        if args.dry_run:
            print(json.dumps(plan, ensure_ascii=False, indent=2))
            return 0

        parent = destination.parent
        if not parent.exists():
            if not args.create_parents:
                raise SetupConfigError(
                    "destination parent does not exist; confirm it and use --create-parents"
                )
            parent.mkdir(parents=True, exist_ok=True)
        if not parent.is_dir():
            raise SetupConfigError("destination parent is not a directory")
        if destination.exists():
            raise SetupConfigError("destination appeared during setup; no files were changed")

        staging = Path(
            tempfile.mkdtemp(
                prefix=f".{destination.name}.note-workspace-", dir=str(parent)
            )
        )
        build_workspace_tree(staging, config, workspace_id, created_at, moment)
        errors = validate_workspace(staging)
        if errors:
            raise SetupConfigError("generated workspace failed validation: " + "; ".join(errors))
        if destination.exists():
            raise SetupConfigError("destination appeared during setup; no files were changed")
        staging.rename(destination)
        staging = None

        plan["status"] = "created"
        plan["validation"] = "pass"
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2
    finally:
        if staging is not None and staging.exists():
            shutil.rmtree(staging)


if __name__ == "__main__":
    raise SystemExit(main())
