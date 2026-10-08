# Notification Content Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Notification Content improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Use a stable semantic event/idempotency identity and keep audience resolution at the authoritative owner.
- Do not leak secrets, private payloads, cross-tenant identifiers, or internal diagnostics into templates or links.
- Preserve preference, unsubscribe, consent, and suppression semantics across retries and channel fallback.
- Update templates, preview fixtures, analytics, tests, provider metadata, and runbooks together.

## Validation

- Run event/template/render/link/provider-adapter tests and preview representative locales/channels.
- Exercise duplicate event, preference denial, provider timeout/retry, stale target, and unauthorized deep link.
- State live-provider deliverability or legal approval gates separately.
