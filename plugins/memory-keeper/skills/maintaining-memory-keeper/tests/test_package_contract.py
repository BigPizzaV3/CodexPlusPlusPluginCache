from __future__ import annotations
import json, re, unittest
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[3]
VERSION = "0.5.0"
MARKER = "MEMORY_KEEPER_V4_2026-09-17"
SKILLS = {
    "using-memory-keeper",
    "maintaining-project-memory",
    "auditing-persistent-state",
    "organizing-persistent-files",
    "repairing-memory-state",
    "recovering-persistent-work",
    "verifying-persistent-work",
    "maintaining-memory-keeper",
}

class PackageContract(unittest.TestCase):
    def test_skill_set(self):
        actual={p.name for p in (PLUGIN/'skills').iterdir() if p.is_dir() and (p/'SKILL.md').is_file()}
        self.assertEqual(actual,SKILLS)

    def test_frontmatter(self):
        for name in SKILLS:
            t=(PLUGIN/'skills'/name/'SKILL.md').read_text(encoding='utf-8')
            self.assertRegex(t,rf'(?m)^name:\s*{re.escape(name)}\s*$')
            m=re.search(r'(?m)^description:\s*(.+)$',t)
            self.assertIsNotNone(m)
            self.assertTrue(m.group(1).strip('"').startswith('Use when'),name)

    def test_versions(self):
        a=json.loads((PLUGIN/'plugin.json').read_text())
        b=json.loads((PLUGIN/'.codex-plugin/plugin.json').read_text())
        self.assertEqual(a['version'],VERSION)
        self.assertEqual(b['version'],VERSION)
        self.assertNotIn('mcp',(json.dumps(a)+json.dumps(b)).lower())
        readme=(PLUGIN/'README.md').read_text(encoding='utf-8')
        self.assertIn(VERSION,readme)
        self.assertIn(MARKER,readme)
        router=(PLUGIN/'skills/using-memory-keeper/SKILL.md').read_text(encoding='utf-8')
        self.assertIn(MARKER,router)

    def test_router_and_recovery_contract(self):
        router=(PLUGIN/'skills/using-memory-keeper/SKILL.md').read_text(encoding='utf-8')
        self.assertIn('BEFORE any response or action',router)
        for name in SKILLS-{'using-memory-keeper'}:
            self.assertIn(name,router)
        recovery=(PLUGIN/'skills/recovering-persistent-work/SKILL.md').read_text(encoding='utf-8')
        for phrase in ['one automatic recovery attempt','same failing step','no progress','oscillates','BLOCKED / NOT COMPLETE','Never relax']:
            self.assertIn(phrase,recovery)


    def test_router_composes_all_applicable_specialists(self):
        router=(PLUGIN/'skills/using-memory-keeper/SKILL.md').read_text(encoding='utf-8')
        for phrase in [
            'Load every applicable specialist',
            'Skills compose; they are not mutually exclusive',
            'audit before organization',
            'recovery before completion verification',
        ]:
            self.assertIn(phrase, router)

    def test_memory_lifecycle_contract(self):
        skill=(PLUGIN/'skills/maintaining-project-memory/SKILL.md').read_text(encoding='utf-8')
        hierarchy=(PLUGIN/'skills/maintaining-project-memory/references/memory-hierarchy.md').read_text(encoding='utf-8')
        corpus=skill+'\n'+hierarchy
        for phrase in [
            'Split trigger',
            'Merge trigger',
            'Compaction trigger',
            'route density',
            'independent ownership',
        ]:
            self.assertIn(phrase, corpus)

    def test_audit_requires_complete_evidence(self):
        audit=(PLUGIN/'skills/auditing-persistent-state/SKILL.md').read_text(encoding='utf-8')
        for phrase in [
            'INCOMPLETE EVIDENCE',
            'pagination',
            'next cursor',
            'truncated',
            'partial listing',
        ]:
            self.assertIn(phrase, audit)

    def test_organization_idempotence_and_final_identity(self):
        org=(PLUGIN/'skills/organizing-persistent-files/SKILL.md').read_text(encoding='utf-8')
        storage=(PLUGIN/'skills/organizing-persistent-files/references/storage-adapters.md').read_text(encoding='utf-8')
        corpus=org+'\n'+storage
        for phrase in [
            'idempotent',
            'returned final identity',
            'destination conflict',
            'auto-rename',
        ]:
            self.assertIn(phrase, corpus)

    def test_repair_provenance_and_rollback_contract(self):
        repair=(PLUGIN/'skills/repairing-memory-state/SKILL.md').read_text(encoding='utf-8')
        for phrase in ['repair provenance','rollback point','superseded source remains recoverable']:
            self.assertIn(phrase, repair)

    def test_recovery_has_global_budget_and_stable_fingerprint(self):
        recovery=(PLUGIN/'skills/recovering-persistent-work/SKILL.md').read_text(encoding='utf-8')
        for phrase in [
            'operation fingerprint',
            'transaction recovery budget',
            'maximum 2 automatic recovery mutations',
            'renaming or subdividing a step does not reset',
            'monotonic progress',
        ]:
            self.assertIn(phrase, recovery)

    def test_verification_evidence_authority_contract(self):
        verify=(PLUGIN/'skills/verifying-persistent-work/SKILL.md').read_text(encoding='utf-8')
        gates=(PLUGIN/'skills/verifying-persistent-work/references/verification-gates.md').read_text(encoding='utf-8')
        corpus=verify+'\n'+gates
        for phrase in [
            'authoritative evidence',
            'provider-native read/list',
            'search/index result alone is insufficient',
            'after the last mutation',
        ]:
            self.assertIn(phrase, corpus)

    def test_official_release_runner_exists(self):
        runner=PLUGIN/'skills/maintaining-memory-keeper/scripts/run_release_tests.py'
        self.assertTrue(runner.is_file(), 'official release runner missing')

    def test_release_tree_clean(self):
        bad=[]
        for p in PLUGIN.rglob('*'):
            n=p.name.lower()
            if p.is_dir() and n=='__pycache__': bad.append(str(p.relative_to(PLUGIN)))
            if p.is_file() and (n.endswith('.pyc') or n.endswith('.pyo') or n.endswith('.tmp') or n.endswith('~')):
                bad.append(str(p.relative_to(PLUGIN)))
        self.assertEqual(bad,[])

    def test_openai_directory_metadata_contract(self):
        import struct
        a=json.loads((PLUGIN/'plugin.json').read_text())
        iface=a['extensions']['com.openai']['interface']
        self.assertTrue(a['author']['name'].strip())
        self.assertLessEqual(len(iface['displayName']),30)
        self.assertLessEqual(len(iface['shortDescription']),30)
        self.assertLessEqual(len(iface['developerName']),80)
        self.assertLessEqual(len(iface['defaultPrompt']),3)
        self.assertTrue(all(isinstance(p,str) and p.strip() and len(p)<=128 and '\n' not in p and '\r' not in p for p in iface['defaultPrompt']))
        for key in ('composerIcon','logo'):
            rel=iface[key]
            self.assertTrue(rel.startswith('./'))
            path=PLUGIN/rel[2:]
            self.assertTrue(path.is_file(),key)
            data=path.read_bytes()[:24]
            self.assertEqual(data[:8],b'\x89PNG\r\n\x1a\n')
            w,h=struct.unpack('>II',data[16:24])
            self.assertEqual(w,h)
            self.assertGreaterEqual(w,48)
            self.assertLessEqual(w,4096)

if __name__=='__main__': unittest.main(verbosity=2)
