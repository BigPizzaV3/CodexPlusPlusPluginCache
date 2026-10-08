from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, List


PLUGIN_ID = "the-autonomous-cio"
MARKETPLACE_ID = "the-autonomous-cio"


DEFAULT_SOURCE_CATEGORIES = {
    "calendar": "executive meetings, board dates and steering cadence",
    "meeting_notes": "decisions, objections, commitments and owner language",
    "document_store": "board packs, architecture notes, audit evidence and policy docs",
    "internal_messaging": "escalation texture, blockers, owner signals and weak signals",
    "delivery_system": "project status, RAID logs, milestones and dependencies",
    "service_system": "incidents, outages, service health and operational risks",
    "security_system": "findings, access controls, exceptions and remediation",
    "finance_system": "budget, forecast, spend, reserve and benefits evidence",
    "local_files": "user-provided files, exports, CSV, JSON, Markdown and text",
}


def state_dir() -> Path:
    root = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    return root / "state" / "plugins" / MARKETPLACE_ID / PLUGIN_ID


def read_user_context(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {
            "status": "missing",
            "entries": [],
            "summary": "No saved Autonomous CIO context found.",
        }
    text = path.read_text(encoding="utf-8")
    entries = []
    current = None
    for line in text.splitlines():
        if line.startswith("# "):
            current = {"category": line[2:].strip(), "items": []}
            entries.append(current)
        elif current and line.strip() and not line.startswith("Description:"):
            current["items"].append(line.strip())
    return {
        "status": "loaded",
        "path": str(path),
        "entries": entries,
        "summary": f"Loaded {len(entries)} saved Autonomous CIO context categories.",
    }


def build_preflight(workflow: str) -> Dict[str, Any]:
    base = state_dir()
    user_context_path = base / "user-context.md"
    onboarding_path = base / "onboarding-state.json"
    context = read_user_context(user_context_path)
    source_categories = [
        {
            "id": key,
            "label": key.replace("_", " ").title(),
            "purpose": value,
            "status": "semantic_category",
        }
        for key, value in DEFAULT_SOURCE_CATEGORIES.items()
    ]
    final_obligations: List[str] = [
        "Keep facts, assumptions, hypotheses and missing evidence separate.",
        "Do not claim live connector access, automatic persistence or executed external actions.",
        "End substantive outputs with one concrete next action unless the user asked for no follow-up.",
    ]
    if context["status"] == "missing":
        final_obligations.append("Mention that no saved Autonomous CIO context was loaded if that materially limits the answer.")
    return {
        "cio_preflight": {
            "workflow": workflow,
            "state_dir": str(base),
            "user_context": context,
            "onboarding_state": {
                "path": str(onboarding_path),
                "status": "loaded" if onboarding_path.exists() else "missing",
            },
            "sources": source_categories,
            "output_preferences": {
                "default_artifact": "Executive Decision Packet for decision-heavy work; Autopilot Review for broad reviews.",
                "default_language": "German when the user writes German; otherwise match user language.",
                "default_style": "executive, evidence-bound, concise, action-oriented",
            },
            "context_gap_note": None if context["status"] == "loaded" else "Saved Autonomous CIO preferences are not set up yet; user-provided context remains sufficient.",
            "final_obligations": final_obligations,
        }
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="The Autonomous CIO preflight")
    parser.add_argument("--workflow", default="index")
    args = parser.parse_args()
    print(json.dumps(build_preflight(args.workflow), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
