---
name: sandbox-python-executor
description: Use when Marketing Swarm needs deterministic metric calculation, tabular analysis, simulation, statistical checks, file processing, or verification that should actually run with host-native Python instead of relying on unverified mental arithmetic.
---

# Sandbox Python Executor

Use the host's own Python execution capability to produce evidence, not just code suggestions.

This Skill does not create a remote runtime and does not declare an MCP dependency. Tool availability belongs to the host.

## Use Python for

- campaign metric calculation across many rows
- period comparisons and decompositions
- scenario and sensitivity analysis
- bootstrap or Monte Carlo calculations when justified
- incrementality/lift statistics
- CSV/JSON parsing and data validation
- deterministic charts/tables when requested
- archive/package verification during Plugin maintenance

## Execution rule

1. Actually execute the calculation when Python is available and the answer depends on it.
2. Keep source campaign files read-only unless the user requested transformation.
3. State assumptions and data-cleaning choices that affect the result.
4. Do not assume sandbox internet access.
5. Do not expose tokens, credentials, or unrelated files.
6. Preserve generated artifacts the user needs and return the host-provided file reference/path when available.

## Evidence

Report enough to distinguish an executed calculation from an estimate: operation, important inputs/filters, pass/fail or result summary, generated file when applicable, and warnings.

## If Python is unavailable

Do not claim execution occurred. Continue with static reasoning only when appropriate and mark execution-dependent calculations as unverified.
