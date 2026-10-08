# Payments Provider Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent payments provider boundary across provider adapter, local billing state, webhook/reconciliation, entitlement updates, UI/API behavior, tests, and docs/maps when used.

## Scope selection

Use the selected checkout/subscription/invoice/webhook/refund/chargeback/reconciliation bug, audit finding, failing test, provider event sample, or explicit billing task. Do not migrate payment providers or redesign pricing unless required by the selected fix.

## Polish targets

- Provider SDK/client wrapper, request construction, idempotency keys, timeouts/retries, and test/live configuration.
- Local billing state machine, invoice/payment records, entitlement activation/deactivation, grace periods, and audit logs.
- Webhook verification, event deduplication, ordering tolerance, replay safety, and reconciliation jobs.
- Billing UI/API states, user notifications, tests/fixtures, generated types, and maps/docs directly affected.

## Implementation principles

- Make local state transitions explicit and monotonic where provider events can arrive late or duplicated.
- Never trust unauthenticated webhooks or client-only payment success.
- Preserve existing customer/subscription data compatibility and define forward-fix for unsafe rollback.
- Avoid touching unrelated pricing, plans, coupons, or tax behavior.

## Validation

Run repository-native tests and safe sandbox/provider-mock scenarios for the selected path: success, failure, duplicate event, delayed event, out-of-order event, refund/chargeback/cancellation when relevant. Report live-provider, tax, or managed-service gates honestly.
