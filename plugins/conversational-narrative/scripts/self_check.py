#!/usr/bin/env python3
from pathlib import Path
import json, re, sys, xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
errors = []
manifest_path = root / '.codex-plugin' / 'plugin.json'
if not manifest_path.is_file(): errors.append('missing .codex-plugin/plugin.json')
else:
    try: m = json.loads(manifest_path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'malformed manifest: {exc}'); m = {}
    if m.get('skills') != './skills/': errors.append('skills path must be ./skills/')
    i = m.get('interface', {})
    limits = {'displayName':30,'shortDescription':30,'longDescription':4000,'developerName':80}
    for k, limit in limits.items():
        v = i.get(k)
        if not isinstance(v, str) or not v: errors.append(f'missing interface.{k}')
        elif len(v) > limit: errors.append(f'interface.{k} exceeds {limit}')
    if i.get('category') not in {'Productivity','Creativity','Developer Tools','Business & Operations','Data & Analytics','Communication','Education & Research','Security','Finance','Healthcare','Travel','Entertainment','Other'}:
        errors.append('unsupported category')
    for k in ('logo','composerIcon'):
        v = i.get(k)
        if not isinstance(v, str) or not v.startswith('./'): errors.append(f'bad interface.{k} path')
        else:
            p = root / v[2:]
            if not p.is_file(): errors.append(f'missing {v}')
            elif p.suffix.lower()=='.svg':
                try:
                    r=ET.fromstring(p.read_text(encoding='utf-8'))
                    vb=r.attrib.get('viewBox','').split()
                    if len(vb)==4 and float(vb[2])!=float(vb[3]): errors.append(f'{v} is not square')
                except Exception as exc: errors.append(f'invalid svg {v}: {exc}')

cp = root / '.codex-plugin'
extras = [p.name for p in cp.iterdir() if p.name != 'plugin.json']
if extras: errors.append('.codex-plugin contains extra files: '+', '.join(extras))

names=[]
for d in sorted((root/'skills').iterdir()):
    if not d.is_dir(): errors.append(f'non-directory under skills: {d.name}'); continue
    sm=d/'SKILL.md'
    if not sm.is_file(): errors.append(f'missing SKILL.md: {d.name}'); continue
    text=sm.read_text(encoding='utf-8')
    match=re.match(r'^---\nname:\s*([^\n]+)\ndescription:\s*([^\n]+)\n---\n', text)
    if not match: errors.append(f'invalid frontmatter: {d.name}'); continue
    name=match.group(1).strip(); names.append(name)
    if name != d.name: errors.append(f'skill name/directory mismatch: {d.name} vs {name}')
if len(names)!=len(set(names)): errors.append('duplicate skill names')

if errors:
    print(json.dumps({'ok':False,'errors':errors}, indent=2, ensure_ascii=False)); sys.exit(1)
print(json.dumps({'ok':True,'skills':names,'skill_count':len(names)}, indent=2, ensure_ascii=False))
