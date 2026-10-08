#!/usr/bin/env python3
"""Convert common ChatGPT or Claude export JSON shapes into markdown files.

Usage:
    python3 conversation_importer.py INPUT OUTPUT_DIR

INPUT may be:
- a JSON file
- a directory containing JSON files

The original files are never modified.
"""
from __future__ import annotations
from pathlib import Path
import json, re, sys
from datetime import datetime, timezone

def slugify(s: str, fallback: str) -> str:
    s = re.sub(r"[^\w\s-]", "", (s or "").strip(), flags=re.UNICODE)
    s = re.sub(r"[-\s]+", "-", s).strip("-").lower()
    return (s[:80] or fallback)

def iso(ts):
    if ts in (None, ""):
        return ""
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()
    except Exception:
        return str(ts)

def content_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        if isinstance(content.get("parts"), list):
            return "\n".join(str(x) for x in content["parts"] if x is not None)
        for key in ("text", "content"):
            if isinstance(content.get(key), str):
                return content[key]
    if isinstance(content, list):
        out = []
        for item in content:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                if isinstance(item.get("text"), str):
                    out.append(item["text"])
                elif isinstance(item.get("content"), str):
                    out.append(item["content"])
        return "\n".join(out)
    return ""

def parse_chatgpt(obj):
    rows = []
    if isinstance(obj, dict) and isinstance(obj.get("mapping"), dict):
        convs = [obj]
    elif isinstance(obj, list):
        convs = [x for x in obj if isinstance(x, dict) and isinstance(x.get("mapping"), dict)]
    else:
        convs = []
    for i, conv in enumerate(convs):
        msgs = []
        nodes = list(conv["mapping"].values())
        nodes.sort(key=lambda n: ((n.get("message") or {}).get("create_time") or 0))
        for n in nodes:
            msg = n.get("message")
            if not isinstance(msg, dict):
                continue
            role = ((msg.get("author") or {}).get("role") or "unknown")
            text = content_text(msg.get("content"))
            if text.strip():
                msgs.append((role, text.strip()))
        if msgs:
            rows.append({
                "title": conv.get("title") or f"ChatGPT conversation {i+1}",
                "created": iso(conv.get("create_time")),
                "source": "chatgpt",
                "messages": msgs
            })
    return rows

def parse_claude(obj):
    if isinstance(obj, dict):
        candidates = obj.get("conversations") if isinstance(obj.get("conversations"), list) else [obj]
    elif isinstance(obj, list):
        candidates = obj
    else:
        candidates = []
    rows = []
    for i, conv in enumerate(candidates):
        if not isinstance(conv, dict):
            continue
        seq = None
        for key in ("chat_messages", "messages"):
            if isinstance(conv.get(key), list):
                seq = conv[key]
                break
        if not seq:
            continue
        msgs = []
        for m in seq:
            if not isinstance(m, dict):
                continue
            role = m.get("sender") or m.get("role") or ((m.get("author") or {}).get("role")) or "unknown"
            text = content_text(m.get("text") if "text" in m else m.get("content"))
            if text.strip():
                msgs.append((str(role), text.strip()))
        if msgs:
            rows.append({
                "title": conv.get("name") or conv.get("title") or f"Claude conversation {i+1}",
                "created": conv.get("created_at") or conv.get("created") or "",
                "source": "claude",
                "messages": msgs
            })
    return rows

def load_objects(path: Path):
    if path.is_dir():
        files = sorted(path.rglob("*.json"))
    else:
        files = [path]
    for f in files:
        try:
            yield f, json.loads(f.read_text(encoding="utf-8", errors="ignore"))
        except Exception as e:
            print(f"SKIP {f}: {e}", file=sys.stderr)

def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    inp = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    written = 0
    skipped = 0
    seen = set()
    for src_file, obj in load_objects(inp):
        convs = parse_chatgpt(obj)
        if not convs:
            convs = parse_claude(obj)
        if not convs:
            skipped += 1
            continue
        for idx, c in enumerate(convs):
            base = slugify(c["title"], f"conversation-{written+1}")
            name = base
            n = 2
            while name in seen or (out / f"{name}.md").exists():
                name = f"{base}-{n}"
                n += 1
            seen.add(name)
            body = [
                "---",
                f'title: {json.dumps(c["title"], ensure_ascii=False)}',
                f'source: {c["source"]}',
                f'created: {json.dumps(c["created"], ensure_ascii=False)}',
                f'import_file: {json.dumps(src_file.name, ensure_ascii=False)}',
                "---",
                "",
                f"# {c['title']}",
                ""
            ]
            for role, text in c["messages"]:
                body += [f"## {role}", "", text, ""]
            (out / f"{name}.md").write_text("\n".join(body), encoding="utf-8")
            written += 1
    print(json.dumps({"written": written, "unrecognized_files": skipped, "output": str(out)}, indent=2))
    return 0 if written else 2

if __name__ == "__main__":
    raise SystemExit(main())
