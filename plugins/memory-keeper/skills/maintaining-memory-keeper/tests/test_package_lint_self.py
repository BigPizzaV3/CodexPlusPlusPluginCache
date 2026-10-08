from __future__ import annotations
import os, shutil, subprocess, sys, tempfile, unittest, zipfile
from pathlib import Path
PLUGIN=Path(__file__).resolve().parents[3]
LINTER=PLUGIN/'skills/maintaining-memory-keeper/scripts/package_lint.py'
class PackageLintSelf(unittest.TestCase):
    def test_source_tree_passes(self):
        r=subprocess.run([sys.executable,str(LINTER),str(PLUGIN)],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertIn('PASS',r.stdout)

    def test_bad_zip_fails_cleanly(self):
        with tempfile.TemporaryDirectory() as td:
            bad=Path(td)/'broken.zip'
            bad.write_bytes(b'not-a-zip')
            r=subprocess.run([sys.executable,str(LINTER),str(bad)],capture_output=True,text=True)
            self.assertNotEqual(r.returncode,0)
            self.assertIn('FAIL',r.stdout)
            self.assertNotIn('Traceback',r.stdout+r.stderr)




    def test_skills_fallback_zip_is_supported(self):
        with tempfile.TemporaryDirectory() as td:
            stage=Path(td)/'stage'
            shutil.copytree(PLUGIN/'skills',stage/'skills')
            (stage/'README.md').write_text('Memory Keeper 0.5.0\nMEMORY_KEEPER_V4_2026-09-17\n')
            zpath=Path(td)/'skills.zip'
            with zipfile.ZipFile(zpath,'w') as zf:
                for f in sorted(stage.rglob('*')):
                    if f.is_file(): zf.write(f,f.relative_to(stage).as_posix())
            r=subprocess.run([sys.executable,str(LINTER),str(zpath)],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stdout+r.stderr)

    def test_stale_diagnostic_marker_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            clone=Path(td)/'memory-keeper'
            shutil.copytree(PLUGIN,clone)
            router=clone/'skills/using-memory-keeper/SKILL.md'
            fake='MEMORY_KEEPER_' + 'V99_1999-01-01'
            router.write_text(router.read_text().replace('MEMORY_KEEPER_V4_2026-09-17',fake))
            r=subprocess.run([sys.executable,str(LINTER),str(clone)],capture_output=True,text=True)
            self.assertNotEqual(r.returncode,0)
            self.assertIn('stale diagnostic marker',r.stdout)

    def test_unsafe_zip_member_fails_cleanly(self):
        with tempfile.TemporaryDirectory() as td:
            bad=Path(td)/'unsafe.zip'
            with zipfile.ZipFile(bad,'w') as zf:
                zf.writestr('../escape.txt','nope')
            r=subprocess.run([sys.executable,str(LINTER),str(bad)],capture_output=True,text=True)
            self.assertNotEqual(r.returncode,0)
            self.assertIn('unsafe ZIP member path',r.stdout)
            self.assertNotIn('Traceback',r.stdout+r.stderr)

    def test_release_runner_does_not_pollute_source(self):
        if os.environ.get('MEMORY_KEEPER_RELEASE_RUNNER_ACTIVE') == '1':
            self.skipTest('nested inside official release runner')
        runner=PLUGIN/'skills/maintaining-memory-keeper/scripts/run_release_tests.py'
        self.assertTrue(runner.is_file(), 'official release runner missing')
        r=subprocess.run([sys.executable,str(runner),'--source',str(PLUGIN)],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        caches=[p for p in PLUGIN.rglob('__pycache__') if p.is_dir()]
        self.assertEqual(caches,[],f'runner polluted source: {caches}')

    def test_openai_directory_metadata_violations_are_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            clone=Path(td)/'memory-keeper'
            shutil.copytree(PLUGIN,clone)
            manifest_path=clone/'plugin.json'
            manifest=__import__('json').loads(manifest_path.read_text())
            manifest.pop('author',None)
            iface=manifest['extensions']['com.openai']['interface']
            iface.pop('developerName',None)
            iface.pop('composerIcon',None)
            iface.pop('logo',None)
            iface['shortDescription']='x'*31
            iface['defaultPrompt']=['one','two','three','four']
            manifest_path.write_text(__import__('json').dumps(manifest,indent=2)+'\n')
            r=subprocess.run([sys.executable,str(LINTER),str(clone)],capture_output=True,text=True)
            self.assertNotEqual(r.returncode,0,r.stdout+r.stderr)
            for phrase in ['author.name missing','developerName missing','shortDescription exceeds 30','defaultPrompt has more than 3','composerIcon missing','logo missing']:
                self.assertIn(phrase,r.stdout)

if __name__=='__main__': unittest.main(verbosity=2)
