from __future__ import annotations
import subprocess, sys, tempfile, unittest
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[3]
CHECKER = PLUGIN/'skills/maintaining-project-memory/scripts/memory_keeper_check.py'

class MemoryChecker(unittest.TestCase):
    def run_check(self, root: Path, *args: str):
        return subprocess.run([sys.executable,str(CHECKER),'--root',str(root),*args],capture_output=True,text=True)

    def test_clean(self):
        with tempfile.TemporaryDirectory() as td:
            r=Path(td); (r/'MEMOIRE_GLOBALE.md').write_text('Plugin: `Plugin/MEMOIRE.md`\n')
            (r/'Plugin').mkdir(); (r/'Plugin/MEMOIRE.md').write_text('# Plugin\n')
            x=self.run_check(r); self.assertEqual(x.returncode,0,x.stdout+x.stderr)

    def test_copy_name(self):
        with tempfile.TemporaryDirectory() as td:
            r=Path(td); (r/'MEMOIRE_GLOBALE.md').write_text('# Root\n'); (r/'MEMOIRE_GLOBALE_FINAL.md').write_text('# copy\n')
            x=self.run_check(r); self.assertNotEqual(x.returncode,0); self.assertIn('suspicious canon-copy',x.stdout)

    def test_broken_reference(self):
        with tempfile.TemporaryDirectory() as td:
            r=Path(td); (r/'MEMOIRE_GLOBALE.md').write_text('`Plugin/MEMOIRE.md`\n')
            x=self.run_check(r); self.assertNotEqual(x.returncode,0); self.assertIn('broken memory/path reference',x.stdout)

    def test_competing_root(self):
        with tempfile.TemporaryDirectory() as td:
            r=Path(td); (r/'MEMOIRE_GLOBALE.md').write_text('# A\n'); (r/'memory.md').write_text('# B\n')
            x=self.run_check(r); self.assertNotEqual(x.returncode,0); self.assertIn('multiple active root-memory conventions',x.stdout)

if __name__=='__main__': unittest.main(verbosity=2)
