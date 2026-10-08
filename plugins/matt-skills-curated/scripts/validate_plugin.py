#!/usr/bin/env python3
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROOT = {
    '.codex-plugin', '.github', '.gitignore', 'AGENTS.md', 'LICENSE', 'PRIVACY.md',
    'README.md', 'SUPPORT.md', 'TERMS.md', 'THIRD_PARTY_NOTICES.md', 'assets',
    'scripts', 'skills', 'source-provenance.json'
}
EXPECTED_SKILL_COUNT = 42
OLD_SLUGS = {'ask-matt', 'setup-matt-pocock-skills', 'git-guardrails-claude-code', 'loop-me', 'claude-handoff'}
FORBIDDEN_NAMES = {'.DS_Store', 'node_modules', '.claude-plugin', '.changeset', '.out-of-scope', 'CLAUDE.md'}
FORBIDDEN_TEXT = ('/Us'+'ers/', 'security-'+'penetration-'+'tester', 'telemetry_'+'init.py')
SEMVER = re.compile(r'^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$')
IDENT = re.compile(r'^[A-Za-z0-9_-]{1,64}$')

errors: list[str] = []

def fail(msg: str) -> None:
    errors.append(msg)

def frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding='utf-8')
    if not text.startswith('---\n'):
        fail(f'{path}: missing YAML frontmatter')
        return {}
    try:
        block = text.split('\n---\n', 1)[0][4:]
    except Exception:
        fail(f'{path}: malformed YAML frontmatter')
        return {}
    data: dict[str, str] = {}
    lines = block.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r'^([A-Za-z0-9_-]+):\s*(.*)$', line)
        if not m:
            i += 1
            continue
        key, value = m.group(1), m.group(2).strip()
        if value in {'>', '>-', '|', '|-'}:
            parts = []
            i += 1
            while i < len(lines) and (lines[i].startswith('  ') or not lines[i].strip()):
                if lines[i].strip(): parts.append(lines[i].strip())
                i += 1
            data[key] = ' '.join(parts)
            continue
        data[key] = value.strip('"\'')
        i += 1
    return data

def yaml_value(text: str, key: str) -> str | None:
    m = re.search(rf'(?m)^\s*{re.escape(key)}:\s*["\']?([^\n"\']+)', text)
    return m.group(1).strip() if m else None

# Root shape
actual = {p.name for p in ROOT.iterdir() if p.name != '.git'}
for extra in sorted(actual - EXPECTED_ROOT): fail(f'unexpected root entry: {extra}')
for missing in sorted(EXPECTED_ROOT - actual): fail(f'missing root entry: {missing}')

# No symlinks or known noise anywhere.
for p in ROOT.rglob('*'):
    if '.git' in p.parts: continue
    if p.is_symlink(): fail(f'symlink is not allowed: {p.relative_to(ROOT)}')
    if p.name in FORBIDDEN_NAMES: fail(f'forbidden artifact: {p.relative_to(ROOT)}')
    if p.is_file() and p.suffix.lower() in {'.md','.json','.yaml','.yml','.py','.sh','.txt'}:
        try: text = p.read_text(encoding='utf-8')
        except UnicodeDecodeError: continue
        for token in FORBIDDEN_TEXT:
            if token in text: fail(f'forbidden text {token!r}: {p.relative_to(ROOT)}')

# Secret-shape scan. Patterns target credential values, not variable names or placeholders.
secret_patterns = {
    'private_key': re.compile(r'BEGIN ' + r'(?:RSA |EC |OPENSSH )?PRIVATE KEY'),
    'aws_access_key': re.compile(r'AKIA[0-9A-Z]{16}'),
    'github_token': re.compile(r'gh[pousr]_[A-Za-z0-9]{20,}'),
    'openai_key': re.compile(r'sk-' + r'(?:proj-)?[A-Za-z0-9_-]{20,}'),
    'slack_token': re.compile(r'xox[baprs]-[A-Za-z0-9-]{20,}'),
}
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.parts:
        continue
    try:
        text = p.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        continue
    for label, pattern in secret_patterns.items():
        if pattern.search(text):
            fail(f'secret-shaped value ({label}): {p.relative_to(ROOT)}')

# Plugin manifest
manifest_path = ROOT/'.codex-plugin'/'plugin.json'
try: manifest = json.loads(manifest_path.read_text())
except Exception as exc:
    fail(f'plugin manifest unreadable: {exc}')
    manifest = {}
if not IDENT.fullmatch(str(manifest.get('name',''))): fail('manifest name invalid')
if not SEMVER.fullmatch(str(manifest.get('version',''))): fail('manifest version must be strict semver')
if manifest.get('skills') != './skills/': fail('manifest skills must be ./skills/')
if not isinstance(manifest.get('author'), dict) or not manifest['author'].get('name'): fail('manifest author.name required')
interface = manifest.get('interface') if isinstance(manifest.get('interface'), dict) else {}
limits = {'displayName':30,'shortDescription':30,'longDescription':4000,'developerName':80}
for key, limit in limits.items():
    value = interface.get(key)
    if not isinstance(value, str) or not value.strip(): fail(f'interface.{key} required')
    elif len(value) > limit: fail(f'interface.{key} exceeds {limit} characters')
if interface.get('category') != 'Developer Tools': fail('interface.category must be Developer Tools')
cap = interface.get('capabilities')
if not isinstance(cap, list) or not 1 <= len(cap) <= 20: fail('interface.capabilities must contain 1..20 items')
else:
    for item in cap:
        if not isinstance(item, str) or not item.strip() or len(item) > 120 or '\n' in item: fail('invalid capability entry')
prompts = interface.get('defaultPrompt')
if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3: fail('interface.defaultPrompt must contain 1..3 prompts')
else:
    norm=set()
    for item in prompts:
        if not isinstance(item, str) or not item.strip() or len(item) > 128 or '\n' in item or '@' in item: fail('invalid defaultPrompt entry')
        n=' '.join(item.lower().split())
        if n in norm: fail('duplicate defaultPrompt entry')
        norm.add(n)
for key in ('websiteURL','privacyPolicyURL','termsOfServiceURL','supportURL'):
    v=interface.get(key)
    if not isinstance(v,str) or not v.startswith('https://'): fail(f'interface.{key} must be HTTPS')
for key in ('logo','composerIcon'):
    v=interface.get(key)
    if not isinstance(v,str) or not v.startswith('./'): fail(f'interface.{key} must be a relative path')
    elif not (ROOT/v[2:]).is_file(): fail(f'interface.{key} file missing: {v}')

# Provenance
try: provenance=json.loads((ROOT/'source-provenance.json').read_text())
except Exception as exc:
    fail(f'provenance unreadable: {exc}')
    provenance={}
curation=provenance.get('curation',{}) if isinstance(provenance,dict) else {}
if curation.get('plugin_version') != manifest.get('version'): fail('provenance plugin_version differs from manifest')
if provenance.get('upstream',{}).get('commit') != '6654f6b60cd9d5be8b54c6fafe44346dabeb3b76': fail('unexpected upstream commit')
if provenance.get('upstream',{}).get('license') != 'MIT': fail('upstream license must be MIT')

# Skills
skills_root=ROOT/'skills'
skill_dirs=sorted([p for p in skills_root.iterdir() if p.is_dir()]) if skills_root.is_dir() else []
if len(skill_dirs) != EXPECTED_SKILL_COUNT: fail(f'expected {EXPECTED_SKILL_COUNT} skills, found {len(skill_dirs)}')
slugs=[]
for d in skill_dirs:
    skill=d/'SKILL.md'; agent=d/'agents'/'openai.yaml'
    if not skill.is_file(): fail(f'{d.name}: missing SKILL.md'); continue
    if not agent.is_file(): fail(f'{d.name}: missing agents/openai.yaml')
    meta=frontmatter(skill)
    name=meta.get('name',''); desc=meta.get('description','')
    if name != d.name: fail(f'{d.name}: frontmatter name is {name!r}')
    if not desc or len(desc) > 1024: fail(f'{d.name}: description missing or too long')
    if not skill.read_text().split('\n---\n',1)[-1].strip(): fail(f'{d.name}: empty skill body')
    slugs.append(name)
    if agent.is_file():
        at=agent.read_text()
        if not yaml_value(at,'display_name'): fail(f'{d.name}: display_name missing')
        if not yaml_value(at,'short_description'): fail(f'{d.name}: short_description missing')
        user_only = meta.get('disable-model-invocation','').lower() == 'true'
        policy_false = bool(re.search(r'(?m)^\s*allow_implicit_invocation:\s*false\s*$', at))
        if user_only or policy_false: fail(f'{d.name}: curated Skills must allow model invocation')
if len(set(slugs)) != len(slugs): fail('duplicate skill names')
for old in OLD_SLUGS:
    if old in slugs: fail(f'old branded slug remains: {old}')
if set(curation.get('skills',[])) != set(slugs): fail('provenance skill list differs from packaged skills')
if curation.get('skill_count') != len(slugs): fail('provenance skill_count differs from packaged skills')

# Router coverage
router=skills_root/'engineering-workflow-guide'
if not router.is_dir(): fail('engineering-workflow-guide missing')
else:
    rmeta=frontmatter(router/'SKILL.md')
    if rmeta.get('disable-model-invocation','').lower() == 'true': fail('router must allow model invocation')
    catalog=(router/'references'/'catalog.md')
    if not catalog.is_file(): fail('router catalog missing')
    else:
        text=catalog.read_text()
        for slug in sorted(set(slugs)-{'engineering-workflow-guide'}):
            count=text.count(f'`{slug}`')
            if count != 1: fail(f'router catalog must mention {slug} exactly once, found {count}')

if errors:
    print(json.dumps({'ok':False,'errors':errors},indent=2))
    sys.exit(1)
print(json.dumps({'ok':True,'plugin':manifest.get('name'),'version':manifest.get('version'),'skills':len(slugs),'files':sum(1 for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts)},indent=2))
