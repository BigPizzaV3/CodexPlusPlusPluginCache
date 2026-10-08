#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory


def run(cmd: list[str], *, env: dict[str, str] | None = None) -> int:
    print('+', ' '.join(cmd))
    proc = subprocess.run(cmd, text=True, env=env)
    return proc.returncode


def main() -> int:
    ap = argparse.ArgumentParser(description='Run Memory Keeper release checks without polluting the source tree')
    ap.add_argument('--source', required=True, help='Memory Keeper plugin source root')
    ap.add_argument('--zip', action='append', default=[], help='Built release ZIP to lint; may be repeated')
    args = ap.parse_args()

    source = Path(args.source).resolve()
    linter = source / 'skills/maintaining-memory-keeper/scripts/package_lint.py'
    tests_rel = Path('skills/maintaining-memory-keeper/tests')
    if not linter.is_file() or not (source / tests_rel).is_dir():
        print('Memory Keeper release tests: FAIL')
        print('ERROR: source does not look like a Memory Keeper plugin root')
        return 2

    # Source must already be clean before execution.
    if run([sys.executable, str(linter), str(source)]) != 0:
        print('Memory Keeper release tests: FAIL (pre-lint)')
        return 1

    with TemporaryDirectory(prefix='mk-release-tests-') as td:
        isolated = Path(td) / 'memory-keeper'
        shutil.copytree(source, isolated)
        env = os.environ.copy()
        env['PYTHONDONTWRITEBYTECODE'] = '1'
        env['MEMORY_KEEPER_RELEASE_RUNNER_ACTIVE'] = '1'
        tests = isolated / tests_rel
        rc = run([
            sys.executable, '-m', 'unittest', 'discover',
            '-s', str(tests), '-p', 'test_*.py', '-v'
        ], env=env)
        if rc != 0:
            print('Memory Keeper release tests: FAIL (unit/contract tests)')
            return rc

        isolated_linter = isolated / 'skills/maintaining-memory-keeper/scripts/package_lint.py'
        if run([sys.executable, str(isolated_linter), str(isolated)], env=env) != 0:
            print('Memory Keeper release tests: FAIL (isolated post-test lint)')
            return 1

    # Prove the runner itself left the real source unchanged/clean.
    if run([sys.executable, str(linter), str(source)]) != 0:
        print('Memory Keeper release tests: FAIL (source polluted by test run)')
        return 1

    for zip_arg in args.zip:
        zp = Path(zip_arg).resolve()
        if run([sys.executable, str(linter), str(zp)]) != 0:
            print(f'Memory Keeper release tests: FAIL (release ZIP lint: {zp})')
            return 1

    print('Memory Keeper release tests: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
