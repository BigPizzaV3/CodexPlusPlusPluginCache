from pathlib import Path
import json, re, sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
errors = []

def check(cond, msg):
    if not cond:
        errors.append(msg)

manifest_path = ROOT/'.codex-plugin/plugin.json'
check(manifest_path.is_file(), 'missing .codex-plugin/plugin.json')
if manifest_path.is_file():
    manifest = json.loads(manifest_path.read_text())
    check(manifest.get('name') == 'marketing-swarm', 'unexpected plugin name')
    check(re.fullmatch(r'\d+\.\d+\.\d+', manifest.get('version','')) is not None, 'version must be semver')
    check(manifest.get('skills') == './skills/', 'skills path must be ./skills/')
    interface = manifest.get('interface', {})
    check(0 < len(interface.get('displayName','')) <= 30, 'displayName length invalid')
    check(0 < len(interface.get('shortDescription','')) <= 30, 'shortDescription length invalid')
    check(len(interface.get('defaultPrompt', [])) <= 3, 'too many starter prompts')
    check(len(interface.get('capabilities', [])) <= 20, 'too many capabilities')

manifest_dir_files = [p.name for p in (ROOT/'.codex-plugin').iterdir() if p.is_file()]
check(manifest_dir_files == ['plugin.json'], '.codex-plugin must contain only plugin.json')

skill_dirs = sorted([p for p in (ROOT/'skills').iterdir() if p.is_dir()])
check(len(skill_dirs) == 11, f'expected 11 skills, found {len(skill_dirs)}')
names = []
for d in skill_dirs:
    f = d/'SKILL.md'
    check(f.is_file(), f'missing SKILL.md in {d.name}')
    if not f.is_file():
        continue
    text = f.read_text()
    m_name = re.search(r'^name:\s*(.+)$', text, re.M)
    m_desc = re.search(r'^description:\s*(.+)$', text, re.M)
    check(bool(m_name and m_desc), f'frontmatter incomplete: {d.name}')
    if m_name:
        names.append(m_name.group(1).strip())
    agent = d/'agents/openai.yaml'
    check(agent.is_file(), f'missing agents/openai.yaml: {d.name}')
    if agent.is_file():
        y = agent.read_text()
        check('display_name:' in y and 'short_description:' in y and 'default_prompt:' in y, f'openai.yaml interface incomplete: {d.name}')
check(len(names) == len(set(names)), 'duplicate skill names')

for rel in ['assets/mark.svg','assets/logo-light.svg','assets/logo-dark.svg']:
    p = ROOT/rel
    check(p.is_file(), f'missing {rel}')
    if p.is_file():
        root = ET.fromstring(p.read_text())
        w = root.attrib.get('width'); h = root.attrib.get('height')
        check(w == h and w and w.isdigit(), f'{rel} must declare numeric square dimensions')

if errors:
    print('\n'.join('FAIL: '+e for e in errors))
    sys.exit(1)
print(f'PASS: plugin structure, {len(skill_dirs)} skills, 3 square SVG assets')
