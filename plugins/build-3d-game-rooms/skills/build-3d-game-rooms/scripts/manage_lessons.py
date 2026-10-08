#!/usr/bin/env python3
"""Maintain durable lessons without erasing rejected or superseded history."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path


REQUIRED = ("sourceRoom", "observation", "rule", "scope", "pipelineStages")


def load(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != "game-room.room-lessons.v1" or not isinstance(data.get("lessons"), list):
        raise SystemExit("invalid lesson ledger")
    return data


def save(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def find(data, lesson_id):
    matches = [lesson for lesson in data["lessons"] if lesson.get("id") == lesson_id]
    if len(matches) != 1:
        raise SystemExit(f"expected exactly one lesson {lesson_id!r}, found {len(matches)}")
    return matches[0]


def main():
    default = Path(__file__).resolve().parent.parent / "references" / "lessons.json"
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", type=Path, default=default)
    sub = parser.add_subparsers(dest="command", required=True)
    propose = sub.add_parser("propose")
    propose.add_argument("--id", required=True)
    for field in REQUIRED:
        propose.add_argument(f"--{field.replace('R', '-r').replace('S', '-s')}", required=True)
    propose.add_argument("--evidence", action="append", default=[])
    propose.add_argument("--metrics-json", default="{}")
    decide = sub.add_parser("decide")
    decide.add_argument("--id", required=True)
    decide.add_argument("--decision", required=True, choices=("approved", "rejected"))
    decide.add_argument("--approved-by", required=True)
    decide.add_argument("--reason", default="")
    supersede = sub.add_parser("supersede")
    supersede.add_argument("--id", required=True)
    supersede.add_argument("--by", required=True)
    args = parser.parse_args()
    ledger = args.ledger.resolve()
    data = load(ledger)
    today = dt.date.today().isoformat()
    if args.command == "propose":
        if any(item.get("id") == args.id for item in data["lessons"]):
            raise SystemExit(f"lesson already exists: {args.id}")
        stages = [item.strip() for item in args.pipeline_stages.split(",") if item.strip()]
        if not stages or any(item not in {"function", "form", "runtime"} for item in stages):
            raise SystemExit("pipeline stages must be function,form,runtime")
        data["lessons"].append({
            "id": args.id, "status": "pending", "sourceRoom": args.source_room,
            "observation": args.observation, "rule": args.rule, "evidence": args.evidence,
            "metrics": json.loads(args.metrics_json), "scope": args.scope,
            "pipelineStages": stages, "proposedAt": today, "decidedAt": None,
            "approvedBy": None, "decisionReason": "", "supersedes": None, "supersededBy": None
        })
    elif args.command == "decide":
        lesson = find(data, args.id)
        if lesson.get("status") != "pending":
            raise SystemExit("only pending lessons can be decided")
        lesson.update(status=args.decision, decidedAt=today, approvedBy=args.approved_by, decisionReason=args.reason)
    else:
        lesson = find(data, args.id)
        replacement = find(data, args.by)
        if lesson.get("status") != "approved" or replacement.get("status") != "approved":
            raise SystemExit("both lessons must be approved before superseding")
        lesson["status"] = "superseded"
        lesson["supersededBy"] = args.by
        replacement["supersedes"] = args.id
    save(ledger, data)


if __name__ == "__main__":
    main()
