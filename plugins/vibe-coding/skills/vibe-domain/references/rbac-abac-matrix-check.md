# RBAC ABAC Matrix Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one RBAC/ABAC policy matrix or patch through bounded allow/deny scenarios. Prove the selected actor/resource/action/scope contract without reopening unrelated auth audit work.

## Required input

Provide the selected role/attribute matrix, resource/action, expected allow/deny states, implementation summary or patch boundary, safe environment, fixtures/accounts, and repository-native commands.

## Scenarios

- Exercise allowed and denied actors across relevant tenant/resource scopes.
- Verify ABAC attributes at their source: ownership, membership, region, status, relationship, plan, quota, or feature flag.
- Check unauthenticated, wrong-tenant, missing attribute, stale attribute, no-plan, over-quota, and admin/impersonation cases when relevant.
- Confirm UI affordance and backend enforcement agree, with safe error/no-access behavior.
