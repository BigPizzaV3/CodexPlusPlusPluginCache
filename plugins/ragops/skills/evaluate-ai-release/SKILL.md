---
name: evaluate-ai-release
description: Evaluate a RAG system or AI-agent release against an accepted baseline, diagnose regressions, and produce explainable PASS, WARN, or BLOCK evidence. Use for candidate traces, RAG evaluation scenarios, model or prompt changes, release gates, citation regressions, abstention checks, and pre-release AI quality reviews.
---

# Evaluate an AI release

Use RAGOps as a deterministic evaluator. Treat its result as release evidence, not as proof that a system is universally correct or safe.

## Workflow

1. Identify the scenario, candidate responses or traces, accepted baseline, and policy thresholds. Do not invent missing fixtures.
2. Read `references/commands.md` when selecting the RAGOps command or interpreting exit codes.
3. Inspect inputs for secrets or personal data before running an evaluation. Keep generated reports private unless the user approves sharing.
4. Run the narrowest applicable command through `python3 scripts/run_ragops.py ...` from this skill directory.
5. Interpret exit code `0` as PASS and exit code `2` as an evaluated BLOCK, not an execution failure. Treat other nonzero codes as operational errors.
6. Verify generated evidence bundles before using them, then report the decision, failed gates, material metric deltas, provenance limitations, and the smallest next action.

## Guardrails

- Do not weaken thresholds, replace the accepted baseline, or omit failing cases to obtain a pass.
- Do not claim semantic correctness when only lexical or citation checks were run.
- Do not run provider-backed evaluation unless the user explicitly supplies and authorizes the provider configuration.
- Do not publish, merge, tag, or deploy based only on this skill's output.
- Preserve input artifacts and command parameters in the final evidence so another reviewer can reproduce the result.
- Distinguish synthetic, production-derived, and live production evidence; never infer adoption from the bundled demo.

## Output

Return a concise release recommendation with: `decision`, `evidence`, `failed_gates`, `limitations`, and `next_action`.
