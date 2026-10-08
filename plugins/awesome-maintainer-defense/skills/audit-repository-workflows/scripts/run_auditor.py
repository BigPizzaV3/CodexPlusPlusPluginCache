#!/usr/bin/env python3
"""Run the bundled Maintainer Defense auditor from an installed plugin."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[3]
STANDALONE_AUDITOR = Path(__file__).resolve().with_name("maintainer-defense.py")
AUDITOR = (
    STANDALONE_AUDITOR
    if STANDALONE_AUDITOR.is_file()
    else PLUGIN_ROOT / "scripts" / "install_kit.py"
)

if __name__ == "__main__":
    sys.argv = [str(AUDITOR), *sys.argv[1:]]
    runpy.run_path(str(AUDITOR), run_name="__main__")
