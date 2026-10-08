#!/usr/bin/env python3
"""Append one exact source input to a user-owned workspace."""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

from source_common import (
    INPUT_TYPES,
    LOG_ID_PATTERN,
    SCHEMA_VERSION,
    VISIBILITIES,
    SourceDataError,
    append_jsonl,
    canonical_hash,
    exclusive_lock,
    load_log_records,
    parse_timestamp,
    raw_log_payload,
    read_text_input,
    require_id,
    resolve_workspace,
    text_hash,
    validate_log_records,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Append an exact source entry to a note Workspace."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument(
        "--input-file", required=True, help="UTF-8 input path, or - to read stdin"
    )
    parser.add_argument("--input-type", required=True, choices=sorted(INPUT_TYPES))
    parser.add_argument("--request-id", required=True)
    parser.add_argument("--visibility", choices=sorted(VISIBILITIES), default="confirm_before_use")
    parser.add_argument("--parent-log-id")
    parser.add_argument("--follow-up-question-file")
    parser.add_argument("--conversation-id", help="Stable ID for a diary conversation")
    parser.add_argument("--speaker", choices=("user", "assistant"))
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    parser.add_argument("--log-id", help="Deterministic log ID for tests or migrations")
    return parser


def _ensure_month_file(workspace: Path, moment: object) -> Path:
    year = workspace / "primary-log" / moment.strftime("%Y")
    if year.exists() and (not year.is_dir() or year.is_symlink()):
        raise SourceDataError("monthly log directory is unsafe")
    year.mkdir(mode=0o700, exist_ok=True)
    target = year / f"{moment.strftime('%Y-%m')}.jsonl"
    if target.exists() and (not target.is_file() or target.is_symlink()):
        raise SourceDataError("monthly log file is unsafe")
    if not target.exists():
        try:
            descriptor = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            pass
        else:
            os.close(descriptor)
    return target


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.input_file == "-" and args.follow_up_question_file == "-":
            raise SourceDataError("stdin cannot provide both input and follow-up question")
        workspace = resolve_workspace(args.workspace)
        if bool(args.conversation_id) != bool(args.speaker):
            raise SourceDataError("--conversation-id and --speaker must be used together")
        if args.conversation_id:
            require_id(args.conversation_id, "conversation_id")
            if args.follow_up_question_file:
                raise SourceDataError("save questions as separate assistant records")
            if args.speaker == "assistant" and args.input_type != "text":
                raise SourceDataError("assistant records require --input-type text")
            if args.speaker == "assistant" and args.visibility != "private":
                raise SourceDataError("assistant records require --visibility private")
        request_id = require_id(args.request_id, "request_id")
        original_text = read_text_input(args.input_file, "original_text")
        question = (
            read_text_input(args.follow_up_question_file, "follow_up_question")
            if args.follow_up_question_file
            else None
        )
        parent_log_id = (
            require_id(args.parent_log_id, "parent_log_id", LOG_ID_PATTERN)
            if args.parent_log_id
            else None
        )
        if args.input_type == "follow_up_answer" and parent_log_id is None:
            raise SourceDataError("follow_up_answer requires --parent-log-id")
        if not args.conversation_id and args.input_type != "follow_up_answer" and parent_log_id is not None:
            raise SourceDataError("--parent-log-id is only valid for follow_up_answer")
        recorded_at, moment = parse_timestamp(args.timestamp)
        log_id = require_id(
            args.log_id or f"log-{moment.strftime('%Y%m%d')}-{uuid.uuid4().hex[:12]}",
            "log_id",
            LOG_ID_PATTERN,
        )
        candidate = {
            "schema_version": 2 if args.conversation_id else SCHEMA_VERSION,
            "log_id": log_id,
            "request_id": request_id,
            "recorded_at": recorded_at,
            "input_type": args.input_type,
            "original_text": original_text,
            "parent_log_id": parent_log_id,
            "follow_up_question": question,
            "visibility": args.visibility,
            "status": "active",
            "content_sha256": text_hash(original_text),
        }
        if args.conversation_id:
            candidate.update({"conversation_id": args.conversation_id, "speaker": args.speaker})
        candidate["payload_sha256"] = canonical_hash(raw_log_payload(candidate))

        with exclusive_lock(workspace / "primary-log/.append.lock", recorded_at):
            records = load_log_records(workspace)
            errors = validate_log_records(records)
            if errors:
                raise SourceDataError("existing source logs are invalid: " + "; ".join(errors))
            by_request = {record["request_id"]: record for record in records}
            existing = by_request.get(request_id)
            if existing is not None:
                if existing.get("payload_sha256") != candidate["payload_sha256"]:
                    raise SourceDataError("request_id is already used for different input")
                print(
                    json.dumps(
                        {
                            "status": "duplicate",
                            "log_id": existing["log_id"],
                            "path": existing["_path"],
                            "validation": "pass",
                            "external_actions": [],
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                return 0
            if any(record["log_id"] == log_id for record in records):
                raise SourceDataError("log_id already exists")
            if parent_log_id is not None and not any(
                record["log_id"] == parent_log_id for record in records
            ):
                raise SourceDataError("parent_log_id does not exist")
            target = workspace / "primary-log" / moment.strftime("%Y") / f"{moment.strftime('%Y-%m')}.jsonl"
            candidate_with_path = dict(candidate, _path=str(target.relative_to(workspace)))
            prospective = sorted(records + [candidate_with_path], key=lambda record: record["_path"])
            errors = validate_log_records(prospective)
            if errors:
                raise SourceDataError("invalid source entry: " + "; ".join(errors))
            target = _ensure_month_file(workspace, moment)
            append_jsonl(target, candidate)

        print(
            json.dumps(
                {
                    "status": "created",
                    "log_id": log_id,
                    "path": str(target.relative_to(workspace)),
                    "validation": "pass",
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
