#!/usr/bin/env python3
"""Create a temporary Creator Workspace, persist a marker, index it, and verify recall."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json, subprocess, sys

root = Path(__file__).resolve().parents[1]
with TemporaryDirectory(prefix="creator-workspace-smoke-") as td:
    w = Path(td)
    for rel in ["brain/raw", "brain/wiki", "brain/imports", "profile", "memory", "projects/dummy", "outputs"]:
        (w / rel).mkdir(parents=True, exist_ok=True)
    marker = "CREATOR_WORKSPACE_SMOKE_2026"
    note = w / "brain/wiki/dummy-note.md"
    note.write_text(f"# Dummy Note\n\nMarker: {marker}\n", encoding="utf-8")
    state = w / "projects/dummy/state.md"
    state.write_text("# Dummy Project\n\nStatus: active\n", encoding="utf-8")
    out = w / "brain/_index.md"
    cp = subprocess.run([sys.executable, str(root / "scripts/wiki_index.py"), str(w / "brain/wiki"), str(out)], capture_output=True, text=True)
    recalled = marker in note.read_text(encoding="utf-8") and "dummy-note.md" in out.read_text(encoding="utf-8")
    result = {"ok": cp.returncode == 0 and recalled, "marker_recalled": recalled, "index_created": out.exists()}
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["ok"] else 1)
