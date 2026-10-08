# AI Feature Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed AI Feature improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Validate and normalize model output at a typed boundary before side effects or user-visible state.
- Keep authorization, tenant filters, quotas, irreversible actions, and product decisions outside model control.
- Bound attempts, tool calls, context, output size, latency, and spend; expose truthful pending/failure/fallback states.
- Version prompts/config/artifacts with affected evals, caches, docs, and rollout controls.

## Validation

- Run deterministic unit/integration/eval fixtures plus malformed output, timeout, refusal, fallback, auth, and schema cases.
- Repeat stochastic evaluations enough to report variance rather than one lucky sample.
- Record live-provider/model-version, safety review, cost, and production telemetry gates separately.
