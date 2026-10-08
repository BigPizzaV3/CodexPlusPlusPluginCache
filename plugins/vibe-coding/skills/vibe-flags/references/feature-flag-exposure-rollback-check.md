# Feature Flag Exposure & Rollback Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one feature flag or rollout invariant through bounded on/off, targeted, rollback, missing-provider, and exposure-measurement scenarios.

## Required input

Provide flag name, expected targeting/default/rollback behavior, implementation summary or patch boundary, safe environment, fixtures/accounts, and repository-native commands.

## Scenarios

- Verify default/off state and targeted/on state.
- Verify backend enforcement and UI visibility agree.
- Exercise rollback/kill switch and missing flag-provider/config behavior.
- Verify plan/role/tenant restrictions and analytics exposure/enrollment events where relevant.
- Check stale flag cleanup only if the selected task includes removal.
