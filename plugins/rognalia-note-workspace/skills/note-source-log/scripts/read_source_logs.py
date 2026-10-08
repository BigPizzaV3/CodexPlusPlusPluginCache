#!/usr/bin/env python3
"""Read a bounded slice of source logs without changing the workspace."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from source_common import (
    LOG_ID_PATTERN, SourceDataError, load_log_records, parse_timestamp,
    require_id, resolve_workspace, validate_log_records,
)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Find user testimony or resume a diary conversation.")
    parser.add_argument("workspace")
    selector = parser.add_mutually_exclusive_group()
    selector.add_argument("--query", help="Literal text to search in user messages only")
    selector.add_argument("--conversation-id", help="Read both speakers in one conversation")
    selector.add_argument("--log-id", help="Read one exact source record")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--offset", type=int, default=0, help="Number of newest matches to skip")
    args = parser.parse_args(argv)
    try:
        if not 1 <= args.limit <= 50 or args.offset < 0:
            raise SourceDataError("limit must be 1..50 and offset must be non-negative")
        if args.conversation_id:
            require_id(args.conversation_id, "conversation_id")
        if args.log_id:
            require_id(args.log_id, "log_id", LOG_ID_PATTERN)
        workspace = resolve_workspace(args.workspace)
        records = load_log_records(workspace)
        errors = validate_log_records(records)
        if errors:
            raise SourceDataError("invalid source logs: " + "; ".join(errors))
        records.sort(key=lambda record: parse_timestamp(record["recorded_at"])[1])
        if args.conversation_id:
            records = [r for r in records if r.get("conversation_id") == args.conversation_id]
        elif args.log_id:
            records = [r for r in records if r["log_id"] == args.log_id]
        else:
            records = [r for r in records if r.get("speaker", "user") == "user"]
            if args.query is not None:
                records = [r for r in records if args.query.casefold() in r["original_text"].casefold()]
        newest = list(reversed(records))
        selected = list(reversed(newest[args.offset:args.offset + args.limit]))
        output = [dict(r, speaker=r.get("speaker", "user")) for r in selected]
        print(json.dumps({
            "status": "pass", "records": output, "matched_count": len(records),
            "has_more": args.offset + args.limit < len(records),
            "next_offset": args.offset + len(selected), "external_actions": [],
        }, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
