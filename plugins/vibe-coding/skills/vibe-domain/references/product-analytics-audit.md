# Product Analytics Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit product analytics and instrumentation quality for existing user/product flows: event taxonomy, firing points, properties, privacy, deduplication, funnel usefulness, tests, and docs. Keep only issues supported by repository evidence; do not recommend adding a new vendor unless the repo already has an explicit direction.

## Inspect

Analytics wrappers, telemetry clients, event constants/types, product metrics/events maps when present, server/client tracking calls, consent/privacy gates, route/action handlers, feature flags, auth/session/tenant context, onboarding/payment/core flows, docs, tests, dashboards/config if committed, and observability conventions.

## Issue classes

- Event taxonomy: duplicated event names, inconsistent properties, no source of truth, unstable IDs, missing tenant/plan/context where safe and necessary.
- Firing correctness: events fire before success, miss failure/cancel states, double-fire on rerender/retry, omit server-confirmed outcomes, or cannot distinguish user intent from system effect.
- Funnel coverage: critical steps in signup/onboarding/billing/core workflow are unmeasurable with existing patterns.
- Privacy and consent: PII/secrets logged, excessive payloads, analytics before consent where the repo models consent, unsafe diagnostic data, or cross-tenant leakage risk.
- Regression resistance: no tests/types/docs for critical events, stale event docs, fragile wrappers, or instrumentation coupled to UI implementation details.
- Operational signal: important product failures lack safe correlation with logs/metrics where the repo already has patterns.

## Priority model

Analytics/instrumentation leaks sensitive data, violates tenant/privacy boundaries, corrupts billing/security-relevant auditability, or causes production instability.

Critical funnel/core behavior cannot be measured, fires incorrectly, duplicates materially, or lacks type/test protection on high-value paths.

Lower-risk but concrete event cleanup: inconsistent naming, missing docs, weak properties, secondary flow gaps, or maintainability issues in wrappers.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for event owner/wrapper and affected flow.
- Include expected event semantics, privacy boundary, acceptance criteria, and validation direction.
- Merge issues by event owner or flow when one fix validates them together.
