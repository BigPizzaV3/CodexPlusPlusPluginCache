# Release Readiness Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit whether a repository or selected feature is ready to ship: correctness, tests, migrations, config, deploy path, observability, security/privacy, UI states, docs, and rollback/recovery. Keep only issues supported by repository evidence and relevant to release risk.

## Inspect

Changed or selected feature areas, product capability/journey/traceability maps, routes/API/jobs/workers, migrations/schemas, RBAC/ABAC and entitlements, payments, notifications, cache/search, feature flags, mobile/extension/desktop delivery surfaces, seed data, env/config, CI/deploy files, tests, docs/runbooks, logs/metrics/health checks, user-facing copy/states, security/privacy boundaries, package/lockfiles, and recent generated maps/plans if present.

## Issue classes

Look for concrete, reachable release blockers or risks in:

- Contract readiness: API/UI/job/schema drift, migration ordering, generated artifact mismatch, missing env/config, version/dependency drift, or external integration mismatch.
- Validation readiness: missing owner-level tests for changed behavior, brittle snapshots, unrun critical checks, no seed/fixture for release path, or visual/regression gaps on main surfaces.
- Operational readiness: missing health/logging/metrics for new failure path, deploy/rollback ambiguity, unsafe cleanup, background job ordering, or absent runbook for critical change.
- Product readiness: missing loading/error/empty/no-access/no-plan/destructive states, misleading copy, unsupported public claims, broken onboarding/billing/permission edge.
- Security/privacy readiness: secret/PII leakage, missing authorization enforcement, unsafe diagnostics, tenant isolation risk, or compliance-sensitive data retention/config issue.

## Priority model

Release can cause data loss/corruption, security/privacy breach, broken paid/core workflow, failed deploy/migration, or irreversible user harm.

Meaningful release risk: missing tests/checks for high-impact behavior, operational blind spot, important UI state gap, integration drift, or rollback/recovery uncertainty.

Lower-risk but concrete readiness issue: stale docs/runbook, minor config ambiguity, secondary test gap, weak copy/state, or maintainability issue likely to slow release support.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the release risk and affected owner.
- Include expected release-safe behavior, acceptance criteria, validation direction, and whether it blocks release or can follow after release.
- Merge issues by release owner/source of truth when one fix validates them together.
