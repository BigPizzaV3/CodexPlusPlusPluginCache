#!/usr/bin/env python3
"""Validate the package, discovery metadata, catalog and links."""

import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit
from catalog_site import render_catalog
from metadata import skill_metadata, ui_metadata, catalog_errors
from release_files import release_files

ROOT=Path(__file__).resolve().parents[1]


def validate(root=ROOT):
    root=root.resolve();errors=[]
    def check(ok,message):
        if not ok:errors.append(message)
    def inside(raw,base=root):
        p=(base/raw).resolve()
        return p if p.is_relative_to(root) else None
    try:
        manifest=json.loads((root/'.codex-plugin/plugin.json').read_text(encoding='utf-8'))
        catalog=json.loads((root/'catalog.json').read_text(encoding='utf-8'))
    except (OSError,ValueError) as exc:return [str(exc)]
    if not isinstance(manifest, dict): return ['plugin.json: expected an object']
    schema_errors = catalog_errors(catalog)
    if schema_errors: return schema_errors
    _, inventory_errors = release_files(root)
    errors.extend(inventory_errors)
    check(manifest.get('name')==root.name=='vibe-coding','Plugin name/folder mismatch')
    check(bool(re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?',manifest.get('version',''))),'Invalid version')
    check(manifest.get('skills')=='./skills/','Invalid skills path')
    check(not any(k in manifest for k in ('hooks','mcpServers','apps')),'Unexpected runtime integration in skills-only package')
    skills={p.parent.name:p for p in (root/'skills').glob('*/SKILL.md')}
    check(len(skills)==catalog.get('skills'),'Catalog skill count mismatch')
    for name,path in skills.items():
        text=path.read_text(encoding='utf-8')
        try: skill_metadata(text, f'skills/{name}/SKILL.md', name)
        except ValueError as exc: errors.append(str(exc))
        meta=path.parent/'agents/openai.yaml'
        check(meta.is_file(),f'Missing UI metadata: {name}')
        if meta.is_file():
            try: values=ui_metadata(meta.read_text(encoding='utf-8'), f'skills/{name}/agents/openai.yaml')
            except ValueError as exc:
                errors.append(str(exc)); continue
            check(25<=len(values.get('short_description',''))<=64,f'UI short description length: {name}')
            check('$'+name in values.get('default_prompt',''),f'Default prompt does not invoke skill: {name}')
    rows=catalog.get('recipes',[]);ids=[r['id'] for r in rows];paths=[r['path'] for r in rows]
    check(len(ids)==len(set(ids)),'Duplicate recipe IDs');check(len(paths)==len(set(paths)),'Duplicate recipe paths')
    for r in rows:
        p=inside(r['path']);check(p is not None and p.is_file(),f'Missing/escaping recipe: {r["id"]}')
        check(r['skill'] in skills,f'Unknown skill: {r["id"]}')
        check(r['mode'] in {'audit','implement','check','map','plan','document','closure','review','probe'},f'Invalid mode: {r["id"]}')
        if p and p.is_file():check(hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],f'Stale recipe hash: {r["id"]}; run catalog.py refresh')
        if r['skill'] in skills:
            entry = skills[r['skill']]
            targets = [inside(unquote(link), entry.parent) for link in re.findall(r'\]\(([^\s)]+)\)', entry.read_text(encoding='utf-8')) if not urlsplit(link).scheme]
            check(p in targets, f'Recipe not reachable from skill: {r["id"]}')
    actual={p.relative_to(root).as_posix() for p in (root/'skills').glob('*/references/*.md')}
    check(actual==set(paths),'Unindexed or missing recipe files')
    for p in root.rglob('*'):
        check(not p.is_symlink(),f'Symlink in package: {p.relative_to(root)}')
        if not p.is_file() or p.suffix!='.md':continue
        text=p.read_text(encoding='utf-8');clean=re.sub(r'```.*?```','',text,flags=re.S)
        for link in re.findall(r'(?<!!)\[[^\]]*\]\(([^\s)]+)\)',clean):
            parts=urlsplit(link)
            if parts.scheme or not parts.path:continue
            target=inside(unquote(parts.path),p.parent)
            check(target is not None and target.exists(),f'Broken/escaping link: {p.relative_to(root)} -> {link}')
        if p.is_relative_to(root/'skills') or p.is_relative_to(root/'references'):
            check(not re.search(r'Codex Cloud|task-sub|Use task briefs creation|Plan mode only|\[TODO:',text,re.I),f'Legacy runtime instruction or unfinished scaffold: {p.relative_to(root)}')
    check(not list(root.rglob('AGENTS.md')),'Package must not install project-level AGENTS.md')
    html=root/'CATALOG.html';check(html.is_file(),'Missing HTML catalog')
    if html.is_file():
        m=re.search(r'<script type="application/json" id="recipe-data">(.*?)</script>',html.read_text(encoding='utf-8'),re.S)
        check(m is not None,'Missing embedded HTML data')
        if m:
            try:
                embedded=json.loads(m[1]);check([r['id'] for r in embedded]==ids,'HTML catalog out of sync')
                for r in embedded:
                    p=inside(r['path'])
                    if p and p.is_file():check(r['body']==p.read_text(encoding='utf-8'),f'Stale HTML recipe: {r["id"]}')
            except (ValueError,KeyError,TypeError):errors.append('Invalid embedded HTML data')
        try:
            expected=render_catalog(rows, root=root)
            check(html.read_text(encoding='utf-8')==expected,'Stale HTML interface or translations; run catalog.py refresh')
        except (OSError,ValueError,KeyError) as exc:
            errors.append(f'Invalid catalog localization: {exc}')
    try:
        portable=json.loads((root/'plugin.json').read_text(encoding='utf-8'))
        for key in ('name','version','description','author','homepage','repository','license','keywords'):
            check(portable.get(key)==manifest.get(key),f'Manifest mismatch: {key}')
        claude=json.loads((root/'.claude-plugin/plugin.json').read_text(encoding='utf-8'))
        check(isinstance(claude,dict),'Claude manifest must be an object')
        if isinstance(claude,dict):
            for key in ('name','version','description','author','homepage','repository','license','keywords'):
                check(claude.get(key)==manifest.get(key),f'Claude manifest mismatch: {key}')
            check(not any(k in claude for k in ('hooks','mcpServers','agents','commands')),'Unexpected Claude runtime integration')
        check(portable.get('$schema')=='https://agent-plugins.org/schemas/1.0.0/plugin.schema.json','Invalid portable schema')
        check(portable.get('extensions',{}).get('com.openai',{}).get('interface')==manifest.get('interface'),'Interface mismatch')
        for key in ('composerIcon','logo'):
            p=inside(manifest.get('interface',{}).get(key,''))
            check(p is not None and p.is_file(),f'Missing asset: {key}')
    except (OSError,ValueError) as exc: errors.append(str(exc))
    return errors


if __name__=='__main__':
    errors=validate()
    if errors:
        print('Validation failed:\n'+'\n'.join('- '+e for e in errors));sys.exit(1)
    data=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
    print(f'PASS: {data["skills"]} skills, {len(data["recipes"])} recipes; hashes, links and metadata verified.')
