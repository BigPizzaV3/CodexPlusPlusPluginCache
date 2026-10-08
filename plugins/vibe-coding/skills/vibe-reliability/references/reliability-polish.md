# Reliability Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected reliability fix at the owner layer without broad redesign, making failure handling explicit, safe, observable, and validated.

## Inspect

The selected failure path, its owner layer, direct callers/consumers, config/env, retry/timeout/idempotency behavior, user-facing errors, logs/metrics, tests, docs/runbooks, and deploy/runtime contracts.

## Focus areas

- Add or tighten timeout/cancellation/deadline behavior using existing repo patterns.
- Make retry/backoff/idempotency behavior explicit and safe for the affected side effect.
- Introduce a bounded degraded mode only when repo evidence supports safe fallback semantics.
- Make startup/readiness/shutdown behavior reflect actual dependency availability.
- Add durable recovery, dead-letter, reconciliation, or operator diagnostics for the selected path when the repo has the seam for it.
- Update tests/docs/config examples for the changed reliability contract.

## Implementation principles

- Fix the selected behavior at the owning layer/source of truth, not only at the visible symptom.
- Keep the diff focused: update direct callers, tests, docs, config, generated artifacts, and runtime contracts only when affected.
- Do not add hidden fallbacks, broad catch blocks, silent retries, speculative flags, new frameworks, or broad abstractions unless repository evidence requires them.
- Preserve existing public/internal contracts unless the selected fix explicitly requires a contract change; update consumers when contracts change.
- Make failure, consistency, idempotency, and performance behavior explicit enough to test or observe.
- Do not log secrets, raw tokens, raw PII, private documents, prompts, or user-visible stack traces.

## Validation

Run repository-native checks for the changed slice. Prefer tests that exercise the owner invariant or hot path, then directly affected integration/build/type checks. If a check cannot run, state the concrete limitation.
