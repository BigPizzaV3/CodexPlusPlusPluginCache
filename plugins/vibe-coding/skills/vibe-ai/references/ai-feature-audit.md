# AI Feature Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit AI-assisted product behavior for correctness, safety, cost, reliability, privacy, and regression risk. Keep only issues supported by current repository evidence, not generic AI best practices.

## Inspect

AI entrypoints, model clients, prompt/message builders, structured-output schemas, tool/function definitions, parsers, streaming handlers, queues/jobs, cache/retry/rate-limit code, RAG/OCR/ML dependencies, user-visible AI states, admin/operator controls, env/config validation, tests/evals, fixtures, logs/metrics/traces, docs, and `docs/ai_map.md` when present as a discovery aid.

## Issue classes

- Input/output contracts: unvalidated model inputs, weak schema parsing, enum/nullability drift, brittle natural-language parsing, partial-response handling, and unhandled refusal/empty output states.
- Prompt and tool boundaries: duplicated prompt rules, stale templates, unsafe tool argument construction, missing tool-result validation, prompt injection exposure through untrusted content, and mismatched user/system intent.
- Reliability: retry storms, non-idempotent replays, streaming state bugs, cache key drift, missing timeout/cancellation behavior, queue amplification, and degraded-provider behavior that misleads users.
- Safety/privacy: PII or secret leakage into prompts/logs, unsafe storage of model inputs/outputs, missing tenant/user scoping in AI context, policy bypass via background jobs, and user-visible diagnostic leakage.
- Cost and limits: unbounded context growth, duplicate model calls, missing rate/usage controls, large attachment handling without guardrails, and absent operator visibility for hot paths.
- Product truthfulness: UI promises not backed by model behavior, generated claims without source evidence, missing citations/source labels when the feature presents factual answers.
- Evaluation: missing or false eval coverage for critical prompts, RAG answers, OCR extraction, tool calls, structured outputs, safety boundaries, or known regressions.

## Priority model

Reachable data/tenant leakage, unsafe tool action, destructive or paid action driven by unvalidated AI output, secret/PII exposure, critical hallucination with product/legal/security impact, or AI behavior that breaks a public/internal contract.

Important AI workflow with weak schema/tool validation, misleading UI state, non-idempotent retry/replay, missing eval for a critical behavior, cost/rate-limit risk on a reachable hot path, or duplicated prompt/domain logic that can diverge.

Lower-risk but concrete quality issue: stale AI docs/map, weak diagnostics boundary, unclear generated-content labeling, localized copy drift, noisy logs, or minor eval gap with reachable regression value.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the AI behavior, owner layer, and affected consumer or user state, plus symbol when possible.
- Include model/prompt/tool/index/eval owner when relevant, expected behavior, acceptance criteria, and validation direction.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same AI capability owner unless fixes, rollout units, eval strategy, or safety boundary differ.
- Do not report abstract AI risks without current repo reachability, user impact, cost impact, or regression risk.
