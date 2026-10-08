#!/usr/bin/env python3
"""SessionStart hook: surface the project's approved meme taste profile.

Reads .claude/meme-marketing/taste-profile.json from the project (written by
`meme-craft tune`). Prints nothing when the file is missing or holds no
decisions, so sessions that never touch memes pay zero context tokens.
"""
import json
import sys
from pathlib import Path

PROFILE_RELATIVE = Path(".claude") / "meme-marketing" / "taste-profile.json"
MAX_ITEMS = 8
MAX_CHARS = 1500


def describe(entries):
    parts = []
    for entry in entries[-MAX_ITEMS:]:
        if not isinstance(entry, dict):
            continue
        ident = str(entry.get("id") or "").strip()
        note = str(entry.get("note") or "").strip()
        if ident and note:
            parts.append(f"{ident} ({note})")
        elif ident or note:
            parts.append(ident or note)
    return "; ".join(parts)


def summarize(profile):
    sections = (
        ("Confirmed preferences", profile.get("confirmed")),
        ("Context-specific", profile.get("contextual")),
        ("Tentative, needs user confirmation", profile.get("tentative")),
        ("Rejected constructions", profile.get("rejected")),
    )
    lines = []
    for label, entries in sections:
        if isinstance(entries, list) and entries:
            text = describe(entries)
            if text:
                lines.append(f"- {label}: {text}")
    if not lines:
        return None
    body = "\n".join(lines)
    if len(body) > MAX_CHARS:
        body = body[:MAX_CHARS].rstrip() + " ..."
    return (
        f"meme-marketing taste profile ({PROFILE_RELATIVE.as_posix()}), apply only when writing memes:\n"
        f"{body}"
    )


def evaluate(event):
    path = Path(event.get("cwd") or ".") / PROFILE_RELATIVE
    if not path.is_file():
        return None
    try:
        profile = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(profile, dict):
        return None
    context = summarize(profile)
    if not context:
        return None
    return {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
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
