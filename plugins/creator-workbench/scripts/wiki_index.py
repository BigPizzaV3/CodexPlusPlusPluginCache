#!/usr/bin/env python3
"""Build a deterministic markdown index for a wiki directory.

Usage:
    python3 wiki_index.py WIKI_DIR OUTPUT_FILE
"""
from pathlib import Path
import json, re, sys

def title_for(path: Path) -> str:
    txt = path.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"(?m)^#\s+(.+?)\s*$", txt)
    if m:
        return m.group(1).strip()
    return path.stem.replace("-", " ").replace("_", " ").strip().title()

def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    root = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    pages = [p for p in root.rglob("*.md") if p.resolve() != out]
    rows = []
    for p in sorted(pages):
        rel = p.relative_to(root).as_posix()
        rows.append((title_for(p), rel))
    lines = ["# Wiki Index", "", f"{len(rows)} pages.", ""]
    for title, rel in rows:
        lines.append(f"- [{title}]({rel})")
    lines.append("")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"pages": len(rows), "output": str(out)}, indent=2))

if __name__ == "__main__":
    main()
