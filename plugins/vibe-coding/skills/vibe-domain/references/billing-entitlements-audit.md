# Billing Entitlements Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit billing, plan, quota, entitlement, tenant, and permission behavior for correctness and user-visible consistency. Keep only issues with repository evidence; do not invent pricing rules, plan names, provider behavior, or business policy.

## Inspect

Plan definitions, auth entitlement maps when present, billing provider integration, webhook handlers, subscription state, entitlement/feature-flag helpers, quota counters, RBAC/ABAC/tenant/workspace ownership, route/API guards, UI gates, upgrade/downgrade/trial/cancel flows, invoices/payment states, jobs/reconciliation, tests, docs, and env/config. Use [Payments Provider Audit](../../vibe-payments/references/payments-provider-audit.md) when the provider runtime/webhook contract itself is the primary risk.

## Issue classes

- Source-of-truth drift: different plan/quota/feature rules across UI, API, workers, docs, tests, and provider mapping.
- Enforcement gaps: visible actions not server-enforced, disabled UI hiding allowed operations, missing tenant/role checks, stale subscription state, or quota race conditions.
- Lifecycle bugs: trial start/end, upgrade/downgrade, cancel/reactivate, payment failure, grace period, webhook retry/order/idempotency, and reconciliation gaps.
- User-facing clarity: no-access/no-plan/over-quota/upgrade copy contradicts actual entitlements or provides unsafe diagnostics.
- Data safety: cross-tenant billing exposure, wrong invoice/account owner, destructive plan action without confirmation/audit trail.
- Regression resistance: missing tests for plan matrix, webhook idempotency, quota boundaries, or UI/API gate alignment.

## Priority model

User can access paid/forbidden data/actions, loses paid access incorrectly, cross-tenant billing/data leak, unsafe webhook mutation, or destructive billing state corruption.

Important entitlement drift, quota/plan race, misleading upgrade/no-access state, missing lifecycle handling, or missing tests for high-value billing paths.

Lower-risk but concrete billing quality issue: stale docs, copy mismatch, minor plan matrix inconsistency, secondary lifecycle gap, or weak regression coverage.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for entitlement source of truth and at least one consuming surface.
- Include affected plan/role/tenant state, expected behavior, acceptance criteria, and validation direction.
- Merge issues by entitlement owner when one fix validates them together.
