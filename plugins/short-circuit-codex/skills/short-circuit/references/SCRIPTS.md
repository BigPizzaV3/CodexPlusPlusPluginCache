# Scripts

Use bundled scripts when they make the task more deterministic, cheaper, or easier to verify. Do not use scripts as a substitute for judgement.

## `scripts/audit_repo.py`

Audit a Python repository against short-circuit repo expectations.

Examples:

```bash
python <skill-dir>/scripts/audit_repo.py --path .
python <skill-dir>/scripts/audit_repo.py --path . --python --makefile --ci
python <skill-dir>/scripts/audit_repo.py --path . --coverage --cassettes --format json
python <skill-dir>/scripts/audit_repo.py --path . --profile library --all --strict --out /tmp/short-circuit-audit.md
python <skill-dir>/scripts/audit_repo.py --path . --profile app --all --strict
```

The script only reads the repository. It does not fix files. Findings may be `pass`, `warn`, `fail`, or `unknown`.

Keep this script focused on deterministic static repo checks: project files, tool configuration, Makefile targets, CI workflows, coverage settings, cassette signals, and docs gates. Do not use it to decide whether a local `Any`, `cast(...)`, or ignore comment is justified; that belongs to agent review plus type-checker output.

This audit checks structural signals only. It cannot validate code quality, test meaning, type escape justification, security, runtime correctness, product fit, or production readiness.

Use `--profile library`, `--profile app`, or `--profile monorepo` so optional surfaces such as `uv.lock` and `publish.yml` are interpreted in context. `--strict` is an audit severity mode, not proof that the repo must adopt every optional surface.

Audit findings are inputs for judgement. Missing Makefile, CI, docs, or publishing files may be expected in early or intentionally minimal repos; do not add those surfaces solely to satisfy an audit report.

## `scripts/run_python.py`

Run Python code through `pydantic-monty>=0.0.18`, a sandboxed Python interpreter, and export captured outputs.

Dependency note:

- `run_python.py` requires `pydantic-monty>=0.0.18`.
- If it is missing, the script fails with an actionable install error instead of falling back silently.
- Prefer this script when the agent needs a small isolated Python sandbox without importing the target repo into the current process.
- Prefer direct repo execution when the task is about the repo's real runtime, imports, package wiring, or integration behavior.

Why `pydantic-monty` here:

- it provides a small bounded execution surface for one-off Python experiments
- it captures stdout/stderr/result as explicit artifacts
- it is cheaper and easier to verify than creating an ad hoc scratch module in the repo
- it keeps "quick experiment" work separate from the repo's actual import graph

Install shape:

```bash
uv add pydantic-monty
```

Fallback only when public user docs need it:

```bash
pip install pydantic-monty
```

Call the Python script with the runtime chosen for the task:

```bash
python <skill-dir>/scripts/run_python.py \
  --code 'print(x + y); x * y' \
  --inputs '{"x": 2, "y": 3}' \
  --stdout-export /tmp/run-001_stdout.txt \
  --stderr-export /tmp/run-001_stderr.txt \
  --result-export /tmp/run-001_result.json
```

If the agent intentionally selected another Python runtime, call that runtime explicitly:

```bash
python <skill-dir>/scripts/run_python.py --code '1 + 2'
```

Use this for small, isolated Python experiments when importing or executing code directly in the target repo would be noisy or risky.

Do not treat it as permission to run untrusted code without review. Keep snippets small, bounded, and artifact-driven.
