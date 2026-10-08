#!/usr/bin/env python3
"""Mark the app schedule synchronized after automation_update succeeds."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--automation-id", default="")
    args = parser.parse_args()
    path = args.workspace.expanduser().resolve() / "Config/command_center_config.json"
    config = json.loads(path.read_text(encoding="utf-8"))
    automation = config.setdefault("automation", {})
    automation["needsCodexSync"] = False
    automation["lastSyncedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if args.automation_id:
        automation["automationID"] = args.automation_id

    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2, ensure_ascii=True)
        handle.write("\n")
    os.replace(temporary, path)
    print(json.dumps({"updated": str(path), "automation_id": automation.get("automationID")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
