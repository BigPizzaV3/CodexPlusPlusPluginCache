#!/usr/bin/env python3
"""Run the dependency-light v4 unit, contract and package tests."""
from __future__ import annotations

import ast
import json
import sys
import unittest
from pathlib import Path


def main() -> int:
    sys.dont_write_bytecode = True
    skill_root = Path(__file__).resolve().parent.parent
    for schema in (skill_root / "schemas").glob("*.json"):
        json.loads(schema.read_text(encoding="utf-8"))
    for source in (skill_root / "scripts").glob("*.py"):
        try:
            ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
        except SyntaxError as exc:
            print(f"Python syntax validation failed: {exc}")
            return 1
    suite = unittest.defaultTestLoader.discover(str(skill_root / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
