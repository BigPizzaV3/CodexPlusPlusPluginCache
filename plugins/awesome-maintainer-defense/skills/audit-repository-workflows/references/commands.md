# Auditor command reference

Run commands from this skill directory; `scripts/run_auditor.py` selects the bundled standalone auditor in a release package and the canonical implementation in a source checkout.

```bash
python3 scripts/run_auditor.py audit TARGET
python3 scripts/run_auditor.py audit TARGET --format json --output REPORT.json
python3 scripts/run_auditor.py audit TARGET --format sarif --output REPORT.sarif
python3 scripts/run_auditor.py audit TARGET --fail-on high
python3 scripts/run_auditor.py audit TARGET --baseline BASELINE.json --new-only --format json
python3 scripts/run_auditor.py audit TARGET --compare-ref origin/main --new-only --fail-on high
python3 scripts/run_auditor.py audit TARGET --config TARGET/.maintainer-defense.json --format json
python3 scripts/run_auditor.py fix TARGET --output recommended.patch
python3 scripts/run_auditor.py fix TARGET --safe-only --output recommended.patch
```

`audit` is read-only. `fix` generates a unified diff and writes only `--output`; it never applies the patch or changes the target repository.

`--new-only` requires exactly one comparison source. `--baseline` reads a schema-v1 report. `--compare-ref` uses an already-present local Git object and audits a temporary archive; it does not fetch or check out the ref. Fetching requires separate network authorization.

Default suppression discovery is limited to `TARGET/.maintainer-defense.json`. Invalid or unmatched active suppressions fail closed. `--fail-on` returns 2 for a matched severity threshold, 1 for an input or configuration error, and 0 otherwise.
