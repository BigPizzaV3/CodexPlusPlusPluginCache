from pathlib import Path
import re, sys
ROOT = Path(__file__).resolve().parents[1]
errors=[]
all_text=''
for p in sorted((ROOT/'skills').glob('*/SKILL.md')):
    t=p.read_text().lower(); all_text += '\n'+t
    body=t.split('---',2)[-1]
    if len(body.split()) < 80:
        errors.append(f'{p.parent.name}: skill too shallow')
    if 'description:' not in t:
        errors.append(f'{p.parent.name}: missing description')

# Guard against claims that the skills-only package itself performs autonomous external mutations.
for bad in [
    'changes campaigns automatically',
    'automatically changes campaigns',
    'guaranteed roas',
    'guarantees roas',
    'prove those are incremental',
]:
    if bad in all_text:
        errors.append(f'unsafe/overclaiming phrase found: {bad}')

required = [
 'campaign-diagnostics','budget-media-allocation','creative-genome-analysis',
 'creative-fatigue-mutation','scenario-simulation','causal-attribution',
 'marketing-memory','decision-quality-gate'
]
router=(ROOT/'skills/marketing-swarm-router/SKILL.md').read_text()
for slug in required:
    if slug not in router:
        errors.append(f'router does not reference {slug}')

if errors:
    print('\n'.join('FAIL: '+e for e in errors)); sys.exit(1)
print('PASS: skill depth, routing coverage, execution-boundary checks')
