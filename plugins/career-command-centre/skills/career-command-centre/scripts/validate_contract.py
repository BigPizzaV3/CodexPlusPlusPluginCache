#!/usr/bin/env python3
"""Validate a v4 JSON artifact without external schema dependencies."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from contracts import VALIDATORS, load_json


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("contract", choices=sorted(VALIDATORS))
    parser.add_argument("json_file")
    parser.add_argument("--json-out")
    args = parser.parse_args()

    source = Path(args.json_file)
    try:
        data = load_json(source)
        errors = VALIDATORS[args.contract](data)
    except Exception as exc:
        errors = [f"<root>: could not read or validate JSON: {exc}"]
    report = {
        "contract": args.contract,
        "source": str(source),
        "passed": not errors,
        "errors": errors,
    }
    payload = json.dumps(report, indent=2)
    if args.json_out:
        Path(args.json_out).write_text(payload, encoding="utf-8")
    print(payload)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
