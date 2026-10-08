---
name: ycloud-whatsapp-media
description: Design, implement locally, or evaluate the YCloud WhatsApp media upload contract, multipart request and response handling, and media-to-message handoff. Use for media upload integration; do not use for sending messages, template lifecycle, readiness, broad integration planning, or real API operations.
---

# YCloud WhatsApp Media

Design or implement a contract-aware media upload integration. Keep this skill
limited to the one media-upload operation and the handoff that follows it.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor Architect handoffs for `scope`, `deliverable`, `mutation`, capability IDs,
project seams, and expected evidence. Without one, default to focused scope and
read-only guidance unless the user explicitly requests local implementation.
Local-write authorization permits multipart builders, adapters, handlers,
test-console bindings, synthetic fixtures, and no-network tests inside the scoped
project. It does not authorize opening or transmitting a real user file or
calling the upload API. Reuse the project's existing UI/interface stack; do not
create a dashboard or select a framework without user/project support.

## Trigger boundary

Use this skill when the user asks to upload WhatsApp media, construct the upload
request, interpret its response, or connect an upload result to a later message.
Route these requests elsewhere:

- Send a message, including a message that references an existing media object: hand off to `ycloud-whatsapp-messages`.
- Create, edit, list, retrieve, delete, or analyze a template: hand off to `ycloud-whatsapp-templates`.
- Design a multi-domain YCloud integration: hand off to `ycloud-integration-architect`.
- Check Developer Kit readiness or run repository-maintenance/issue-tracker workflows: do not trigger this skill.
- Download, inspect, or transmit a real local file: stop and use a synthetic fixture instead.

Do not load the complete OpenAPI document. Read only
`references/openapi.md` and `references/runtime.md` after this skill has been selected. If retry, idempotency, queueing, or error translation is requested, also read `references/shared/integration-boundaries.md`. Treat the exact
source path, method, operationId, schema, and constraints in that generated
reference as authoritative. If the reference is missing, stale, or conflicts
with the pinned source, report the drift and stop rather than guessing.

## Workflow

1. Identify the server-side project location and runtime only from files the user
   explicitly places in scope. Ask for missing facts; do not assume a framework,
   SDK, package, deployment, or credential source. When local writes are
   authorized, preserve existing project patterns and concurrent edits.
2. Select the single upload operation documented in the reference:
   `POST /whatsapp/media/{phoneNumber}/upload`, operationId
   `whatsapp_media-upload`. Preserve its path parameter, multipart content type,
   required fields, request schema, response schema, and documented descriptions
   exactly as generated. Apply the standard error envelope, request ID, generic
   `429` headers, documented `413 CONTENT_TOO_LARGE`, the one-file rule,
   reviewed media type/size limits, and 30-day persistence from `runtime.md`.
   Reject multiple files locally even though the API would process only the
   first. Do not invent a media-specific quota, safe replay rule, idempotency,
   or durable retention beyond that period.
   Interpret `allOf` as schema composition and `x-*` extensions or generated
   model names as codegen hints, not additional business behavior.
3. Produce a contract-aware request construction using placeholders such as
   `<YCLOUD_API_KEY>`, `<PHONE_NUMBER>`, and synthetic media metadata. Raw HTTP
   examples are allowed. Use an SDK-specific example only when the project or
   user supplies a confirmed artifact and version; never derive a method name
   from `operationId`.
4. Explain the response only to the extent confirmed by the reference. Identify
   the media identifier/reference needed by a later message, without implying
   that an upload sent a WhatsApp message. Prefer the returned media ID for a
   normal media message, but preserve the documented exception that an
   interactive-message header must use a link instead of a Media ID.
5. Place the upload at the server-side integration boundary (for example, an
   application service or adapter) and keep the API key out of browsers, mobile
   apps, URLs, logs, source control, and generated snippets. Do not read `.env`,
   secret stores, logs, or customer media.
6. Treat upload timeouts as ambiguous and never replay automatically. Any
   project idempotency record, queue, retry budget, or Problem Details response
   is local policy, not a YCloud feature.
7. Give synthetic tests for multipart construction, exactly-one-file validation,
   supported type/size boundaries, 30-day lifecycle handling, path-parameter
   handling, response/reference mapping, the interactive-header link exception,
   and the upload-to-message handoff. Tests must not call YCloud or upload a real
   file.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation. Preserve these
contract and evidence outcomes:

1. **Matched contract** — reference source hash, path, method, operationId,
   request content type/schema, response schema, and confirmed constraints.
2. **Request construction** — placeholder raw HTTP or project-local snippet;
   state any project facts still needed.
3. **Response and handoff** — map only confirmed response fields to a media
   reference, then hand off message composition/sending to
   `ycloud-whatsapp-messages`.
4. **Integration placement** — server-side module, configuration boundary, and
   redacted observability guidance.
5. **Tests** — synthetic unit/contract tests and negative cases.
6. **CANNOT** — list unknown contract facts, missing project facts, unsupported
   media operations, SDK uncertainties, and every action intentionally not run.
7. **Handoff** — return to Architect with `whatsapp_media-upload` status,
   changed or proposed artifacts, tests/results, unknowns, and the confirmed
   media-reference contract for Messages; otherwise state that no handoff is
   needed.

## Safety stop

Never call the YCloud API, open or transmit a real user file, persist credentials,
or claim that media was sent. Local code changes are allowed only when explicitly
requested and remain synthetic/no-network. A request to perform a real upload
stops before the external action even when local implementation was authorized.
