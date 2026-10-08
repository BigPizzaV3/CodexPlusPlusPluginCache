# Webhook receiver contract

This reference is the Developer Kit's single source for receiver signing,
event names, and delivery semantics. Endpoint CRUD paths and schemas remain in
the Webhook Skill's generated `openapi.md`.

## Authority

- Provider contract: [Webhook integration guide](https://docs.ycloud.com/reference/webhook-integration-guide), [Configure webhooks](https://docs.ycloud.com/reference/configure-webhooks), and the pinned OpenAPI `EventType` schema.
- Developer Kit receiver policy: the explicitly labeled defaults below.
- Golden vectors: `webhook-signature-vectors.tsv`.
- Canonical event catalog: `webhook-event-types.txt`.

Legacy examples that append a final period, serialize an already parsed JSON
object, or use underscore event aliases are not contract sources. Generated
code must fail closed instead of preserving those behaviors.

## Signature contract

`YCloud-Signature` has exactly this value shape:

```text
t=<positive Unix timestamp in seconds>,s=<64 lowercase hexadecimal characters>
```

Construct the HMAC message as bytes, in this exact order:

```text
ASCII(decimal timestamp) || 0x2e || exact raw HTTP request body bytes
```

Use the endpoint secret bytes as the HMAC key and HMAC-SHA256 as the digest.
There is one separator byte before the body and no trailing delimiter. Compare
the 32 received/computed digest bytes with a constant-time primitive. Do not
compare ordinary strings.

For `Content-Type: application/json`, YCloud sends JSON encoded as UTF-8. The
receiver must capture the exact bytes before parsing. Whitespace, key order,
Unicode escaping, and a terminal newline are signed data. Parsing and then
serializing the same JSON value produces different bytes and must fail the
signature check.

## Recommended receiver policy

These values are Developer Kit defaults, not YCloud provider guarantees:

- Reject when `abs(nowUnixSeconds - t) > 300`. This checks both stale and
  future timestamps; make the 300-second default configurable.
- Compute comparisons for every explicitly configured candidate secret and
  combine the boolean results without returning on the first secret. This lets
  an application support a bounded current/previous-secret cutover without
  claiming that YCloud provides an old-secret overlap window.
- After verification, atomically claim
  `(webhook_endpoint_id, timestamp, signature)` for at least 300 seconds to
  block an identical transport replay inside the accepted timestamp window.
- Durably deduplicate business processing by
  `(provider, webhook_endpoint_id, event_id)`. The Developer Kit default inbox
  retention is 24 hours and may be increased for the project's recovery
  window. It is not an event-retention guarantee from YCloud.
- Resolve endpoint and tenant identity from trusted receiver configuration,
  never from the event body.

## Event identity and message lifecycle

Verify the signature before parsing or trusting `event.id`, `type`,
`whatsappMessage.id`, or any status. An invalid signature is a rejected transport
attempt: it does not enter the event inbox, has no business duplicate/conflict
classification, and never updates a message projection. A project may retain a
redacted transport-attempt hash for security diagnostics, but that is not an
accepted webhook event.

Keep these identities and outcomes separate:

- `Event.id` is the webhook event identity and the only payload field used in
  the durable inbox key `(provider, webhook_endpoint_id, event_id)`.
- `Event.whatsappMessage.id` is the message identity used to correlate status
  observations. It is never an event deduplication key.
- `inboxClassification` is `new`, `duplicate`, or `conflict`, and exists only
  after successful signature verification and durable claim.
- `projectionOutcome` is a separate consumer result such as `applied`,
  `no_change`, `out_of_order`, `unsupported`, or `failed`.

The exact same scoped event ID and payload hash is a duplicate. The same scoped
event ID with a different hash is a conflict. Different event IDs are distinct
inbox events even when they have the same event type, message ID, or message
status. In particular, `sent`, `delivered`, `read`, and `failed` observations for
one message must not be collapsed into duplicate events. More than one
`delivered` event for the same message can also be a distinct event; an
idempotent projection may report `no_change` without changing the event's `new`
classification.

Message status notifications are not guaranteed to arrive in order, and
`delivered` and `failed` observations can appear in either order. Preserve an
immutable observation history. A project-owned current-state projection may use
the message `updateTime` plus event provenance, but must retain contradictory,
equal-time, missing-time, and older observations for reconciliation instead of
inventing a globally monotonic status rank. Receive time is not event order.

Use `webhook-message-lifecycle-fixtures.json` for executable receiver and
projection tests. Never trust the mock-only
`X-YCloud-Mock-Event-Classification` header as receiver input; compute the
classification locally from the verified body and durable inbox state.

Rotating an endpoint secret is a high-risk management action. Deploy the new
secret immediately after rotation. The public contract does not define the old
secret's validity, a dual-secret overlap, atomic cutover, or rollback. A
receiver may accept an explicitly configured candidate list, but the Skill must
keep the provider overlap itself in `CANNOT`.

## Delivery semantics

- Return any `2xx` promptly after signature verification and durable
  acceptance; the response body is ignored. Move business work to a queue.
- A non-`2xx` response or failure to respond triggers retries after 10 seconds,
  30 seconds, 5 minutes, 30 minutes, 1 hour, 2 hours, and 2 hours. After those
  seven retries, YCloud does not retry that event again.
- Delivery may be repeated. Message status notifications are not guaranteed to
  arrive in order. Do not model transport acceptance as exactly-once or as a
  monotonic business state transition.
- A frequently failing URL can be suspended for 3 minutes. YCloud sends no
  requests to it during suspension and resumes automatically. The public
  contract does not promise backfill for events created during suspension.
- Treat unfamiliar dotted event types as compatible additions: verify,
  durably record an observable unsupported-event state, acknowledge, and avoid
  business side effects.

## Canonical event names

The ordered contents of `webhook-event-types.txt` must exactly match the pinned
OpenAPI `components.schemas.EventType.enum`. Every public event type is dotted.
In particular, use `whatsapp.inbound_message.received` and
`whatsapp.message.updated`; do not emit legacy underscore aliases or singular
update variants.

## Vector format

`webhook-signature-vectors.tsv` is UTF-8 TSV with base64 for every byte string.
`raw_body_base64` and `verification_secrets_base64` are the verifier inputs.
The `signing_*` fields make each header reproducible, including intentionally
bad trailing-delimiter and body-reserialization cases. Synthetic secrets and
payloads only are included.
