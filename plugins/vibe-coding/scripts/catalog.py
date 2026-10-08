#!/usr/bin/env python3
"""Search the shipped recipes and regenerate their offline catalog."""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from catalog_site import load_locales, render_catalog, LANGUAGES
from search_index import build_index, match_score

ROOT = Path(__file__).resolve().parents[1]
MODE_NAMES = load_locales()['en']['modes']


def load_catalog():
    return json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))


def contained_path(raw):
    p=(ROOT/raw).resolve()
    if not p.is_relative_to(ROOT) or not p.is_file():
        raise ValueError(f'Invalid recipe path: {raw}')
    return p


def search(rows, query='', mode=None, skill=None):
    index = build_index(rows, load_locales(), ROOT)
    result = []
    for row in rows:
        if mode and row['mode'] != mode: continue
        if skill and row['skill'] != skill: continue
        score = match_score(index[row['id']], query)
        if score is not None: result.append((score, row))
    return [row for _, row in sorted(result, key=lambda item: -item[0])]


def render_html(rows):
    return render_catalog(rows)


def refresh():
    catalog=load_catalog()
    english = load_locales()['en']
    for row in catalog['recipes']:
        row['title'] = english['titles'][row['id']]
        row['category'] = english['categories'][row['skill']]
        row['summary'] = english['summaries'][row['skill']]
        row['example'] = english['ui']['prompt'].format(skill=row['skill'], title=row['title'], id=row['id'])
        row['sha256']=hashlib.sha256(contained_path(row['path']).read_bytes()).hexdigest()
    catalog['skills']=len(list((ROOT/'skills').glob('*/SKILL.md')))
    (ROOT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8', newline='\n')
    (ROOT/'CATALOG.html').write_text(render_html(catalog['recipes']),encoding='utf-8', newline='\n')
    entries = ['# Vibe Coding catalog', '', 'Choose the requested domain and operation. Each link opens its focused skill. In Codex use `$skill-name`; in Claude Code use `/vibe-coding:skill-name`.', '', '| Skill | When to use | Workflows |', '|---|---|---|']
    for skill in sorted({r['skill'] for r in catalog['recipes']}):
        count = sum(r['skill'] == skill for r in catalog['recipes'])
        entries.append(f"| [`{skill}`](../skills/{skill}/SKILL.md) | {english['summaries'][skill]} | {count} |")
    (ROOT/'references/catalog.md').write_text('\n'.join(entries)+'\n', encoding='utf-8', newline='\n')
    print(f'Refreshed {len(catalog["recipes"])} recipes; wrote CATALOG.html')




def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    p=sub.add_parser('search');p.add_argument('query',nargs='?',default='');p.add_argument('--mode',choices=MODE_NAMES);p.add_argument('--skill');p.add_argument('--json',action='store_true');p.add_argument('--lang',choices=LANGUAGES,default='en');p.add_argument('--host',choices=['codex','claude'],default='codex')
    p=sub.add_parser('show');p.add_argument('id')
    sub.add_parser('refresh')
    args=parser.parse_args()
    if args.command=='refresh':refresh();return
    rows=load_catalog()['recipes']
    if args.command=='show':
        matches=[r for r in rows if r['id']==args.id]
        if not matches:parser.error('Unknown recipe ID. Use search first.')
        print(contained_path(matches[0]['path']).read_text(encoding='utf-8'));return
    rows=search(rows,args.query,args.mode,args.skill)
    locale = load_locales()[args.lang]
    rows = [{**r, 'title': locale['titles'][r['id']], 'category': locale['categories'][r['skill']], 'summary': locale['summaries'][r['skill']], 'example': locale['ui']['promptClaude' if args.host=='claude' else 'prompt'].format(skill=r['skill'], title=locale['titles'][r['id']], id=r['id'])} for r in rows]
    if args.json:print(json.dumps(rows,ensure_ascii=False,indent=2))
    else:
        for row in rows:
            command = '/vibe-coding:'+row['skill'] if args.host=='claude' else '$'+row['skill']
            print(f'{row["id"]} | {command} | {locale["modes"][row["mode"]]}\n  {row["title"]} — {row["category"]}')
        print(f'Found: {len(rows)}')


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
