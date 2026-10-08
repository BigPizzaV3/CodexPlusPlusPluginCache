#!/usr/bin/env python3
"""Validate room contracts and block incomplete milestones."""

from __future__ import annotations

import argparse
from pathlib import Path
from room_contracts import validate_package


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    parser.add_argument("--gate", choices=("function", "form", "runtime"), default="runtime")
    args = parser.parse_args()
    errors = validate_package(args.package.resolve(), args.gate)
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)
    print(f"PASS: {args.gate} gate")


if __name__ == "__main__":
    main()
