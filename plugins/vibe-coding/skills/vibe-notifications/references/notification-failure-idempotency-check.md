# Notification Failure & Idempotency Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one notification delivery invariant through bounded success, failure, duplicate, retry, consent, and provider-status scenarios.

## Required input

Provide notification type/channel, selected invariant, expected delivery/status behavior, implementation summary or patch boundary, safe sandbox/mock environment, fixtures, and repository-native commands.

## Scenarios

- Trigger the notification once and verify the rendered payload/status.
- Trigger duplicates or job redelivery and prove no duplicate side effect unless explicitly allowed.
- Exercise provider failure, timeout/rate limit, retry, bounce/suppression/status webhook, and recovery behavior.
- Verify consent/unsubscribe, locale/template data, and sensitive metadata handling where relevant.
