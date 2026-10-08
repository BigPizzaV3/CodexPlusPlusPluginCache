# Local Client Runtime Security Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one browser-extension or desktop-app local runtime security invariant through bounded permission, storage, messaging/IPC, update/restart, and failure scenarios.

## Required input

Provide selected local-runtime boundary, expected security behavior, implementation summary or patch boundary, supported platform/browser, safe environment, fixtures/accounts, and commands/manual scenarios.

## Scenarios

- Verify permission request/denial/revocation behavior.
- Verify message/IPC payload validation and trust-boundary rejection.
- Verify token/secret/local data storage and logging behavior.
- Exercise reload/restart/update/offline/failure states relevant to the selected boundary.
- Run build/package checks when the patch changes release artifacts.
