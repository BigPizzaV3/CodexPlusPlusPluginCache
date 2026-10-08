#!/usr/bin/env python3
from pathlib import Path
import json, re, sys, xml.etree.ElementTree as ET
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
errors=[]; warnings=[]
manifest_path=root/'.codex-plugin'/'plugin.json'
if not manifest_path.is_file(): errors.append('missing .codex-plugin/plugin.json')
extra=[]
if (root/'.codex-plugin').exists():
    extra=[p.name for p in (root/'.codex-plugin').iterdir() if p.name!='plugin.json']
if extra: errors.append('.codex-plugin contains extra entries: '+', '.join(extra))
try: m=json.loads(manifest_path.read_text())
except Exception as e: errors.append('manifest parse failed: '+str(e)); m={}
name=m.get('name','')
if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', name): errors.append('invalid plugin name')
if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?',m.get('version','')): errors.append('version is not strict semver')
if not str(m.get('skills','')).startswith('./'): errors.append('skills path must start ./')
for k in ('composerIcon','logo'):
    p=m.get('interface',{}).get(k)
    if p:
        if not p.startswith('./') or '..' in Path(p).parts: errors.append(k+' has unsafe path')
        fp=root/p[2:]
        if not fp.is_file(): errors.append(k+' missing')
        elif fp.suffix.lower()=='.svg':
            try:
                el=ET.fromstring(fp.read_text())
                w=float(re.sub('[^0-9.]','',el.attrib.get('width','0'))); h=float(re.sub('[^0-9.]','',el.attrib.get('height','0')))
                if w<=0 or h<=0 or abs(w-h)>0.001: errors.append(k+' SVG must have positive square dimensions')
            except Exception as e: errors.append(k+' invalid SVG: '+str(e))
skills=root/'skills'
if not skills.is_dir(): errors.append('missing skills directory')
seen=set(); count=0
for d in sorted(skills.iterdir()) if skills.is_dir() else []:
    if not d.is_dir(): errors.append('non-directory entry directly under skills: '+d.name); continue
    if d.is_symlink(): errors.append('symlink skill directory: '+d.name); continue
    f=d/'SKILL.md'
    if not f.is_file(): errors.append('skill missing SKILL.md: '+d.name); continue
    txt=f.read_text()
    mm=re.match(r'^---\n(.*?)\n---\n',txt,re.S)
    if not mm: errors.append('invalid frontmatter: '+d.name); continue
    meta=mm.group(1)
    nm=re.search(r'^name:\s*(.+)$',meta,re.M); ds=re.search(r'^description:\s*(.+)$',meta,re.M)
    if not nm or not nm.group(1).strip(): errors.append('missing skill name: '+d.name); continue
    skill_name=nm.group(1).strip().strip('"\'')
    if skill_name in seen: errors.append('duplicate skill name: '+skill_name)
    seen.add(skill_name); count+=1
    if not ds or not ds.group(1).strip(): errors.append('missing skill description: '+d.name)
    agent=d/'agents'/'openai.yaml'
    if not agent.is_file(): warnings.append('missing agents/openai.yaml: '+d.name)
for p in root.rglob('*'):
    if p.is_symlink(): errors.append('symlink in package: '+str(p.relative_to(root)))
    if p.name in {'.DS_Store','Thumbs.db'} or '__pycache__' in p.parts or p.suffix=='.pyc': errors.append('transient file: '+str(p.relative_to(root)))
print(json.dumps({'ok':not errors,'skill_count':count,'errors':errors,'warnings':warnings},indent=2))
sys.exit(0 if not errors else 1)
