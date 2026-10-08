#!/usr/bin/env python3
"""Register approved role-family master CV paths in config and evidence JSON."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path


def atomic_write(path: Path, value: dict) -> None:
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=True)
        handle.write("\n")
    os.replace(temporary, path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument(
        "--master",
        action="append",
        required=True,
        metavar="FAMILY=PATH",
        help="Repeat for each approved master.",
    )
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()
    masters: dict[str, str] = {}
    for item in args.master:
        family, separator, raw_path = item.partition("=")
        if not separator or not family.strip() or not raw_path.strip():
            raise SystemExit(f"Invalid --master value: {item!r}")
        path = Path(raw_path).expanduser().resolve()
        if not path.exists():
            raise SystemExit(f"Master does not exist: {path}")
        masters[family.strip()] = str(path)

    evidence_path = workspace / "Evidence_Bank/approved_evidence.json"
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    evidence["approved_master_cvs"] = masters
    atomic_write(evidence_path, evidence)

    config_path = workspace / "Config/command_center_config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config.setdefault("cv", {})["selectedMasterPaths"] = list(masters.values())
    atomic_write(config_path, config)

    print(json.dumps({"registered": masters}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
