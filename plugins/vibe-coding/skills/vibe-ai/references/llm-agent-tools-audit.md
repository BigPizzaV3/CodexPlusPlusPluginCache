# LLM Agent Tools Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit agentic AI flows that let an LLM choose tools, call functions, mutate data, browse/search, run code, or orchestrate multi-step work. Keep only reachable issues that affect correctness, safety, permissions, cost, observability, or eval coverage.

## Inspect

Agent loops, tool/function schemas, tool routers, system/developer prompts, structured outputs, retry/repair logic, approval gates, sandboxing, permission checks, tenancy filters, external API calls, mutation tools, background jobs, memory/state, streaming UI, traces/logs, evals, fixtures, docs, and generated AI maps when present.

## Issue classes

- Tool contract drift: vague schemas, ambiguous required fields, missing enum constraints, no idempotency metadata, weak output validation, or callers that assume fields the tool does not guarantee.
- Permission and safety gaps: tools bypass tenant/user/plan checks, mutation tools bypass the established authorization policy or require fresh approval for a consequential action without obtaining it, prompt-injected tool arguments can alter protected state, or external browsing/search leaks private context.
- Agent loop control: unbounded iterations, retry storms, recursive tool calls, no timeout/cancel path, duplicate side effects, or incomplete recovery after partial tool failure.
- Grounding and memory: stale or unsafe memory, user/project context mixed across sessions, hidden context overriding explicit user intent, and unsupported claims after tool failure.
- UI/UX contract: streaming hides tool status, destructive operations lack review, errors are opaque, or user cannot distinguish draft/reviewed/applied results.
- Cost and operations: missing rate limits, no per-run budget, high-cost tools on hot paths, weak traceability, and absent diagnostics for low-confidence/failed tool calls.
- Existing user authorization can cover a bounded routine mutation; do not demand a new confirmation for every write solely because it changes state.
- Evaluation: missing tool-choice evals, mutation safety fixtures, adversarial prompt-injection cases, tenant isolation tests, and golden traces for critical workflows.

## Priority model

Unauthorized tool access, cross-tenant/user data exposure, unapproved destructive/paid mutation, prompt-injection path to protected actions, or unbounded loop/cost on a reachable workflow.

Important tool-choice correctness issue, missing critical agent eval, idempotency/retry gap with user-visible impact, weak structured output validation, or misleading streaming/review UX.

Lower-risk tool schema ambiguity, trace/docs gap, weak non-critical recovery state, cost visibility issue, or maintainability drift in agent/tool routing.
