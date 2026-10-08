#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SUSPICIOUS_RE = re.compile(
    r"(?i)(?:^|[_\-\s])(?:maj|final\d*|updated|new|copy|backup|bak|v\d+|\(\d+\)|20\d{2}[-_]\d{2}[-_]\d{2})(?:[_\-\s.]|$)"
)
MEMORY_NAME_RE = re.compile(r"(?i)(memoire|memory)")
DEFAULT_ROOT_NAMES = ("MEMOIRE_GLOBALE.md", "memory.md", "MEMORY.md")
SPECIALIZED_NAMES = ("MEMOIRE.md", "memory.md", "MEMORY.md")


def extract_path_refs(text: str) -> set[str]:
    refs: set[str] = set()
    for m in re.finditer(r"`([^`\n]+\.md)`", text):
        refs.add(m.group(1).strip())
    for m in re.finditer(r"\[[^\]]*\]\(([^)\n]+\.md)\)", text):
        refs.add(m.group(1).strip())
    return refs


def main() -> int:
    ap = argparse.ArgumentParser(description="Memory Keeper local structural validator")
    ap.add_argument("--root", required=True)
    ap.add_argument("--root-memory", default=None)
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = Path(args.root).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []
    info: list[str] = []

    if not root.is_dir():
        errors.append(f"project root does not exist or is not a directory: {root}")
        return emit(args, root, errors, warnings, info)

    memory_files = [p for p in root.rglob("*.md") if p.is_file() and MEMORY_NAME_RE.search(p.name)]
    for p in memory_files:
        if SUSPICIOUS_RE.search(p.stem):
            errors.append(f"suspicious canon-copy style memory filename: {p.relative_to(root)}")

    if args.root_memory:
        root_memory = (root / args.root_memory).resolve()
        if not root_memory.is_file():
            errors.append(f"configured root memory does not exist: {root_memory}")
            root_memory = None
    else:
        candidates = [root / n for n in DEFAULT_ROOT_NAMES if (root / n).is_file()]
        root_memory = candidates[0] if candidates else None
        if not candidates:
            errors.append("no root memory found (expected MEMOIRE_GLOBALE.md or configured equivalent)")
        elif len(candidates) > 1:
            errors.append("multiple active root-memory conventions detected: " + ", ".join(p.name for p in candidates))

    if root_memory:
        root_text = root_memory.read_text(encoding="utf-8", errors="replace")
        for ref in sorted(extract_path_refs(root_text)):
            if "://" in ref or ref.startswith("#"):
                continue
            target = (root_memory.parent / ref).resolve()
            try:
                target.relative_to(root)
            except ValueError:
                warnings.append(f"root memory references path outside project: {ref}")
                continue
            if not target.exists():
                errors.append(f"broken memory/path reference from root memory: {ref}")

        child_memories = [
            p for p in root.rglob("*")
            if p.is_file() and p != root_memory and p.name in SPECIALIZED_NAMES
        ]
        for p in child_memories:
            rel = p.relative_to(root).as_posix()
            if rel not in root_text and p.parent.name not in root_text:
                warnings.append(f"specialized memory may be un-routed from root: {rel}")

    info.append(f"memory files scanned: {len(memory_files)}")
    return emit(args, root, errors, warnings, info)


def emit(args, root: Path, errors: list[str], warnings: list[str], info: list[str]) -> int:
    failed = bool(errors) or (args.strict and bool(warnings))
    payload = {
        "root": str(root),
        "status": "FAIL" if failed else "PASS",
        "errors": errors,
        "warnings": warnings,
        "info": info,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"Memory Keeper check: {payload['status']}")
        for msg in errors:
            print(f"ERROR: {msg}")
        for msg in warnings:
            print(f"WARN:  {msg}")
        for msg in info:
            print(f"INFO:  {msg}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
