# Mobile Release & Offline Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one mobile release, navigation, offline/sync, permission, push, or deep-link invariant through bounded simulator/device or repository-native scenarios.

## Required input

Provide selected mobile behavior, platform(s), expected state transitions, implementation summary or patch boundary, safe simulator/device environment, fixtures/accounts, and commands.

## Scenarios

- Exercise online happy path and relevant offline/stale/retry/reconnect state.
- Verify navigation/deep link/app link and back-stack behavior where relevant.
- Verify platform permission prompts, secure storage, push/background behavior, or biometrics only when in scope.
- Run build/test/release config checks for the changed platform contour.
- Confirm analytics/crash/logging behavior if directly affected.
