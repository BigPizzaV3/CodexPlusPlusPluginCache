#!/usr/bin/env python3
"""Run the bundled RAGOps CLI without requiring package installation."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PLUGIN_ROOT = SCRIPT_DIR.parents[2]
source_root = PLUGIN_ROOT / "src"
if not source_root.is_dir():
    source_root = SCRIPT_DIR / "vendor"
sys.path.insert(0, str(source_root))

if __name__ == "__main__":
    sys.argv = ["ragops", *sys.argv[1:]]
    runpy.run_module("ragops.cli", run_name="__main__")
