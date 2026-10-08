# RAGOps command selection

- Inspect a scenario: `python3 scripts/run_ragops.py inspect --scenario PATH`
- Evaluate candidate responses: `python3 scripts/run_ragops.py evaluate --scenario PATH --responses PATH`
- Compare candidate and baseline: run `python3 scripts/run_ragops.py compare --help` and provide the exact required paths.
- Generate a credential-free evidence bundle: `python3 scripts/run_ragops.py demo --profile engineer --output OUTPUT_DIR`
- Verify an evidence bundle: `python3 scripts/run_ragops.py evidence verify --bundle OUTPUT_DIR/evidence`
- Explain a canonical decision: `python3 scripts/run_ragops.py explain --input OUTPUT_DIR/decision.json`

Run `python3 scripts/run_ragops.py COMMAND --help` before using an unfamiliar option. Exit code `2` from an evaluation means the release gate deliberately blocked the candidate.

The public upload bundle includes a vendored copy of the dependency-free RAGOps core and review fixtures under `references/fixtures/`. The repository checkout uses its canonical `src/ragops` package instead.
