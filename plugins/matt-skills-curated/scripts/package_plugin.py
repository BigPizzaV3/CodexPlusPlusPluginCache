#!/usr/bin/env python3
from __future__ import annotations
import hashlib, os, stat, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).expanduser().resolve() if len(sys.argv)>1 else ROOT/'dist'/'matt-skills-curated.zip'
SKIP_TOP={'.git','node_modules','dist'}
SKIP_NAMES={'.DS_Store','__pycache__'}
files=[]
for p in ROOT.rglob('*'):
    rel=p.relative_to(ROOT)
    if not rel.parts or rel.parts[0] in SKIP_TOP: continue
    if any(part in SKIP_NAMES for part in rel.parts): continue
    if p.is_symlink(): raise SystemExit(f'symlink not allowed: {rel}')
    if p.is_file() and p.resolve()!=OUT: files.append((rel,p))
OUT.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(OUT,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for rel,p in sorted(files,key=lambda x:x[0].as_posix()):
        info=zipfile.ZipInfo(rel.as_posix(),date_time=(1980,1,1,0,0,0))
        info.create_system=3
        mode=0o755 if os.access(p,os.X_OK) else 0o644
        info.external_attr=(stat.S_IFREG|mode)<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes())
data=OUT.read_bytes()
print(f'{OUT}\nsha256={hashlib.sha256(data).hexdigest()}\nbytes={len(data)}\nfiles={len(files)}')
