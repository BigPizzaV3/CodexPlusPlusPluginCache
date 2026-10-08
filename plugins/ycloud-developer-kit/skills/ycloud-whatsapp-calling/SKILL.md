---
name: ycloud-whatsapp-calling
description: Design, implement locally, or evaluate YCloud WhatsApp Calling connect, pre-accept, accept, reject, terminate, and call-media download operations. Use for API-sourced call sessions after Phone Numbers and Webhook Receiver handoffs; exclude calling settings, media upload, message operations, and real API calls.
---

# YCloud WhatsApp Calling

Design or implement contract-aware WhatsApp Calling session commands and call
media downloads. Keep every example synthetic and every transport mock-only;
never call YCloud or Meta, inspect credentials or customer data, or claim that a
real call changed state.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor Architect handoffs for scope, deliverable, mutation, capability IDs,
project seams, and evidence. Without one, default to focused read-only guidance
unless the user explicitly requests local implementation. Local-write
authorization permits trusted-server request builders, adapters, handlers,
state models, synthetic webhook fixtures, mock transports, and no-network tests
inside the scoped project. It never authorizes a real call command or media
download.

After this Skill is selected, read the generated [OpenAPI
contract](references/openapi.md) and reviewed [runtime
behavior](references/runtime.md). If retry, idempotency, queueing, error
translation, or production architecture is requested, also read
`references/shared/integration-boundaries.md`. If either Calling reference is
missing, stale, or inconsistent with the pinned source hash and operation count,
report drift and stop rather than reconstructing the contract from memory.

## Exact operation scope

| Intent | Method and path | operationId |
| --- | --- | --- |
| Connect an outbound call | `POST /whatsapp/calls/connect` | `whatsapp_call-connect` |
| Pre-accept an inbound call | `POST /whatsapp/calls/preAccept` | `whatsapp_call-pre-accept` |
| Accept an inbound call | `POST /whatsapp/calls/accept` | `whatsapp_call-accept` |
| Reject an inbound call | `POST /whatsapp/calls/reject` | `whatsapp_call-reject` |
| Terminate an active call | `POST /whatsapp/calls/terminate` | `whatsapp_call-terminate` |
| Download call recording/transcription | `GET /whatsapp/calls/media/{mediaAssetId}` | `whatsapp_call-download-media` |

Calling/capture configuration belongs to `ycloud-whatsapp-phone-numbers`.
Webhook signature verification, raw-body handling, durable acceptance,
deduplication, and event parsing belong to the Webhook Receiver. Media upload
belongs to `ycloud-whatsapp-media`; WhatsApp message submission and message IDs
belong to `ycloud-whatsapp-messages`; authentication belongs to
`ycloud-api-authentication`; broad multi-domain planning belongs to
`ycloud-integration-architect`.

## Required incoming handoffs

- **Phone Numbers:** consume a separately confirmed WhatsApp Business
  `phoneId`, source E.164 phone number, and Calling/capture readiness evidence.
  Settings or registration success is only prerequisite evidence; it does not
  authorize a call command or prove that a call can connect.
- **Webhook Receiver:** consume only a signature-verified, durably accepted,
  deduplicated call event. For inbound pre-accept, accept, reject, or terminate,
  take `wacid` and `phoneId` from the parsed Call Connect/session event. For a
  recording or transcription, take `mediaAssetId`, `wacid`, `phoneId`, and
  `status` from the parsed media event. Do not alter the Receiver's already
  issued HTTP acknowledgement.

Never substitute one identifier for another. Keep these opaque, case-sensitive
values in separately named fields:

- `wacid`: WhatsApp call/session ID.
- `phoneId`: WhatsApp Business phone-number ID; not an E.164 phone number.
- `from` and `to`: E.164 phone-number strings; never numeric values.
- `recipient`: BSUID or parent BSUID; not a phone, call, message, or event ID.
- `event.id`: webhook envelope event ID; never a call-command identifier.
- message IDs and application correlation IDs: unrelated to Calling commands.
- `mediaAssetId`: call recording/transcription asset ID; only this value belongs
  in the media-download path.

## Contract-first workflow

1. Match only the six allowlisted operations. Report the pinned source hash,
   exact method/path, `operationId`, request schema, response schema, and
   description-only behavior. An `operationId` is not an SDK method name.
2. For outbound `connect`, require `from`, `sdpType: "offer"`, and SDP. Preserve
   the contract's `to`/`recipient` rule: provide exactly one; if an upstream
   caller supplies both, `to` takes precedence and `recipient` is ignored. Do
   not convert phone strings or BSUIDs into another identifier type.
3. For inbound `preAccept` and `accept`, require `phoneId`, `wacid`,
   `sdpType: "answer"`, and SDP. Pre-accept establishes the media connection to
   reduce connection time/audio clipping; accept begins media flow after the
   WebRTC connection. Do not skip local session-order validation merely because
   both endpoints share a request schema.
4. For `reject` and `terminate`, require only `phoneId` and `wacid`. Reject is
   for an incoming call; terminate is for an active call. Treat choosing the
   wrong lifecycle command as an application error, not as a retry strategy.
5. A `200` Calling response requires `success` and may return `wacid`. Interpret
   it only as the selected command being accepted or processed. It is not proof
   of ringing, connection, media flow, termination visibility, or any final session state.
   Correlate later verified call events by `wacid`, preserve
   duplicate/out-of-order/unknown states, and keep command records separate
   from the event-derived session projection.
6. Download call media only after a recording/transcription event reports
   `status: AVAILABLE` and supplies its own `mediaAssetId`. Encode that opaque ID
   as one path segment. Omit `Range` or send it blank; a non-empty `Range` is a
   documented `400` because byte ranges are unsupported. A `200` is the complete
   attachment, `Accept-Ranges` is `none`, recordings use `.ogg`, transcriptions
   use `.json`, and the owning tenant can download for 30 days. Treat `404` as
   intentionally non-disclosing across missing, unavailable, expired, or
   wrong-tenant assets.
7. Preserve the standard error envelope and redacted `YCloud-Request-ID` /
   `error.requestId`. Branch on HTTP status and `error.code`, never expose the
   diagnostic `error.message` directly to end users, and preserve unknown
   properties, event types, and statuses.
8. Do not automatically replay any Calling POST after timeout, connection loss,
   `429`, or an ambiguous response. `Retry-After` delays later traffic but does
   not make replay safe. A provider `retryable` flag on failed media processing
   concerns the upstream media operation; it does not authorize replay of a
   call command or download request. Require fresh session evidence and an
   explicit application-owned decision before any new command.
9. Use placeholders such as `<YCLOUD_API_KEY>`, `<PHONE_ID>`,
   `<SYNTHETIC_WACID>`, `<E164_PHONE_NUMBER>`, and `<MEDIA_ASSET_ID>`. Tests must
   use a fake transport that fails closed on real base URLs, credentials, or
   network clients.

## Media download handoff

Produce a typed handoff only after verified `whatsapp.call.recording.updated` or
`whatsapp.call.transcription.updated` evidence:

- event type, webhook `event.id`, `wacid`, `phoneId`, `mediaAssetId`, and
  `AVAILABLE` status, each in a separate field;
- owning-tenant context, media kind, 30-day expiry/freshness evidence, and the
  mock-only download authorization decision;
- complete-file semantics, expected `.ogg` or `.json` attachment, no byte-range
  support, redacted request ID, and destination/storage policy owned by the
  consuming application.

On `FAILED`, retain the structured `error.code` and `error.retryable` evidence
but do not construct a download request. Never pass `wacid`, `phoneId`, a
message ID, or `event.id` as `mediaAssetId`.

## Validation and evidence

For local implementation, add no-network tests for all six routes; exact body
requiredness; `offer` versus `answer`; `to`/`recipient` precedence; opaque ID and
E.164 preservation; lifecycle command selection; command acceptance versus
event-derived final state; duplicate/out-of-order/unknown events; timeout and
`429` no-replay behavior; standard errors/request IDs; `AVAILABLE` versus
`FAILED`; 30-day media eligibility; blank/non-empty `Range`; complete binary
responses and attachment metadata; `404` nondisclosure; and rejection of every
cross-ID substitution. Mocks must prove no network client is invoked.

Return these sections, adapted to the requested deliverable: **Matched
contract**, **Incoming handoffs**, **Construction or implementation**,
**Command versus session state**, **Media download handoff**, **Tests and
evidence**, **CANNOT**, and **Handoff**. Return capability status, artifacts,
results, unknowns, and outgoing handoffs to Architect when applicable.

## Safety stop

YCloud Provider API calls are prohibited during Skill execution, including the
media GET. Stop before any request using a real key, tenant, phone, call, event,
message, media, SDP, or customer identifier. Never claim a call or media
session changed in production.
