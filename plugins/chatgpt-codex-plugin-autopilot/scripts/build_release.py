#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from self_check import ROOT, SKILL_REL, stage_plugin, validate_stage


def build(out_dir: Path) -> dict:
    manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    out_dir.mkdir(parents=True, exist_ok=True)
    archive = out_dir / f"chatgpt-codex-plugin-autopilot-{version}.zip"
    with tempfile.TemporaryDirectory(prefix="plugin-autopilot-release-") as temp:
        stage = stage_plugin(Path(temp) / "plugin")
        validate_stage(stage)
        packager = stage / SKILL_REL / "scripts/package_plugin.py"
        proc = subprocess.run(
            ["python3", str(packager), str(stage), str(archive), "--json"],
            text=True, capture_output=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr or proc.stdout)
        package_report = json.loads(proc.stdout)
        extract = Path(temp) / "extract"
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(extract)
        validate_stage(extract)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != package_report["sha256"]:
        raise RuntimeError("packager SHA256 does not match final archive")
    sums = out_dir / "SHA256SUMS"
    sums.write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
    return {
        "ok": True,
        "version": version,
        "archive": str(archive),
        "sha256": digest,
        "checksums": str(sums),
        "bytes": archive.stat().st_size,
        "entries": package_report["entries"],
        "skills": package_report["skills"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="dist")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        report = build(Path(args.out_dir).expanduser().resolve())
    except Exception as exc:
        if args.json:
            print(json.dumps({"ok": False, "errors": [str(exc)]}, indent=2, sort_keys=True))
        else:
            print(f"release build: FAIL: {exc}")
        return 1
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"release build: PASS {report['archive']} sha256={report['sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
