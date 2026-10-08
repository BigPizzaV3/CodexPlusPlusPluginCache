#!/usr/bin/env python3
"""PostToolUse hook: run the meme contract validator on meme batch JSON files.

Only files whose root object has "skill": "meme-marketing" are checked, so the
hook stays silent in every other project. When the batch fails, the hook
returns decision=block with the exact failures so Claude repairs the file
before handing it to the user. Any unexpected error exits 0 without output;
a guardrail must never break the session.
"""
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # never write caches into the installed plugin folder
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

MAX_REPORTED = 20


def target_path(event):
    tool_input = event.get("tool_input") or {}
    raw = tool_input.get("file_path") or tool_input.get("path")
    if not isinstance(raw, str) or not raw.lower().endswith(".json"):
        return None
    path = Path(raw)
    if not path.is_absolute():
        path = Path(event.get("cwd") or ".") / path
    return path if path.is_file() else None


def evaluate(event):
    """Return the hook response dict, or None when there is nothing to say."""
    path = target_path(event)
    if path is None:
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("skill") != "meme-marketing":
        return None

    from validate import check

    errors = check(data)
    if not errors:
        count = len(data.get("memes") or [])
        return {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": (
                    f"meme-marketing validator: {path.name} passed structural checks "
                    f"({count} meme spec(s)). Humor, cultural fit and asset rights still need the BinEval review."
                ),
            }
        }
    shown = errors[:MAX_REPORTED]
    extra = len(errors) - len(shown)
    lines = "\n".join(f"- {error}" for error in shown)
    if extra > 0:
        lines += f"\n- ...and {extra} more"
    return {
        "decision": "block",
        "reason": (
            f"meme-marketing validator found {len(errors)} contract failure(s) in {path}:\n{lines}\n"
            "Fix the file so it matches references/output-contract.md, then save it again."
        ),
    }


def main():
    try:
        event = json.load(sys.stdin)
        response = evaluate(event)
    except Exception:  # noqa: BLE001 - hooks must fail open
        return 0
    if response:
        print(json.dumps(response, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
