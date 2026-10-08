# Tenant Isolation Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one tenant/workspace/project isolation invariant through bounded cross-tenant scenarios. Prove the selected patch or behavior without broadening into unrelated auth or data audit work.

## Required input

Provide the selected resource/action, tenant states, implementation summary or patch boundary, safe fixtures/accounts, and repository-native commands or manual scenarios.

## Scenarios

- Same-tenant access succeeds with correct data.
- Wrong-tenant read, list, search, write, export, job, or object access fails safely.
- Missing/stale tenant context fails safely.
- Admin/staff/impersonation access follows explicit policy and produces audit evidence when required.
- Cache/search/analytics/logging surfaces do not expose another tenant’s data for the selected boundary.
