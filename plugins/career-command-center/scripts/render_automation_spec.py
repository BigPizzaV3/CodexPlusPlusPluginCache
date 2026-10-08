#!/usr/bin/env python3
"""Render the Codex automation specification from the app's current config."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = PLUGIN_ROOT / "references/AUTOMATION_PROMPT.md"


def nested(data: dict, section: str, key: str, fallback: object) -> object:
    block = data.get(section) or {}
    return block.get(key, fallback)


def rrule(config: dict) -> str:
    frequency = str(nested(config, "automation", "frequency", "manual"))
    hour = int(nested(config, "automation", "hour", 8))
    minute = int(nested(config, "automation", "minute", 0))
    weekdays_only = bool(nested(config, "automation", "weekdaysOnly", False))
    if frequency == "weekly":
        day_name = str(nested(config, "automation", "weeklyDay", "Monday")).lower()
        day = {
            "monday": "MO",
            "tuesday": "TU",
            "wednesday": "WE",
            "thursday": "TH",
            "friday": "FR",
            "saturday": "SA",
            "sunday": "SU",
        }.get(day_name, "MO")
        return f"FREQ=WEEKLY;BYDAY={day};BYHOUR={hour};BYMINUTE={minute};BYSECOND=0"
    days = "MO,TU,WE,TH,FR" if weekdays_only else "MO,TU,WE,TH,FR,SA,SU"
    return f"FREQ=WEEKLY;BYDAY={days};BYHOUR={hour};BYMINUTE={minute};BYSECOND=0"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()
    config_path = workspace / "Config/command_center_config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    automation = config.get("automation") or {}
    minimum = int(automation.get("minimumNewLeads", 3))
    depth = int(automation.get("searchDepthMinutes", 90))
    automation_id = str(automation.get("automationID") or "career-command-center-daily")
    frequency = str(automation.get("frequency") or "manual")
    enabled = bool(automation.get("enabled", False)) and frequency != "manual"
    name = {
        "daily": "Career Command Center Daily Search",
        "weekly": "Career Command Center Weekly Search",
        "manual": "Career Command Center Manual Search",
    }.get(frequency, "Career Command Center Search")

    prompt = TEMPLATE.read_text(encoding="utf-8")
    replacements = {
        "{{WORKSPACE}}": str(workspace),
        "{{CONFIG}}": str(config_path),
        "{{STRATEGY}}": str(workspace / "Evidence_Bank/CV_GENERATION_STANDARD.md"),
        "{{MIN_LEADS}}": str(minimum),
        "{{SEARCH_DEPTH_MINUTES}}": str(depth),
    }
    for source, destination in replacements.items():
        prompt = prompt.replace(source, destination)

    print(
        json.dumps(
            {
                "automation_id": automation_id,
                "name": name,
                "enabled": enabled,
                "status": "ACTIVE" if enabled else "PAUSED",
                "rrule": rrule(config),
                "workspace": str(workspace),
                "config_path": str(config_path),
                "prompt": prompt,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
