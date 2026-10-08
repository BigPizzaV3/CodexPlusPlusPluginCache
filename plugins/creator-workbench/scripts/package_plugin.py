#!/usr/bin/env python3
"""Build a deterministic ZIP with plugin files at archive root."""
from pathlib import Path
import hashlib, json, sys, zipfile

def build(src: Path, dst: Path):
    files = sorted([p for p in src.rglob("*") if p.is_file()], key=lambda p: p.relative_to(src).as_posix())
    with zipfile.ZipFile(dst, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for p in files:
            rel = p.relative_to(src).as_posix()
            zi = zipfile.ZipInfo(rel)
            zi.date_time = (2026, 8, 22, 0, 0, 0)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o100644 << 16
            zf.writestr(zi, p.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return hashlib.sha256(dst.read_bytes()).hexdigest()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: package_plugin.py SOURCE_DIR OUTPUT.zip")
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    sha = build(src, dst)
    print(json.dumps({"output": str(dst), "sha256": sha, "bytes": dst.stat().st_size}, indent=2))
