---
name: ycloud-integration-architect
description: Design, implement, or evaluate a cross-domain YCloud integration from local project context, with explicit scope, deliverable, mutation boundaries, domain handoffs, and coverage evidence. Use for broad integration or multi-domain orchestration; do not use for readiness, repository-maintenance, issue-tracker, support, or requests confined to one domain.
---

# YCloud Integration Architect

Orchestrate a contract-aware YCloud integration across every Developer Kit-owned
domain. Normalize the request before acting, delegate
domain contract decisions to the matching Skill, and merge their evidence into
one result. Never call a real YCloud API, read credentials or customer data, or
infer permission for an external action from permission to edit local files.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

## Normalize the request

Resolve these dimensions from the user's words and project context:

```text
scope: focused | full-first-wave | full-whatsapp-operations | full-supported-operations
deliverable: project-integration | test-console | production-plan
mutation: read-only | local-write-authorized
```

- Default to `focused` when the user names a concrete outcome or domain.
- “All currently supported capabilities” means `full-supported-operations`: 88
  API operations plus 2 cross-cutting capabilities = 90 coverage rows.
- `full-first-wave` remains a compatibility mode: 17 API operations + 2
  cross-cutting capabilities = 19 coverage rows.
- “All YCloud APIs” requires an explicit `88 API operations + 2 cross-cutting capabilities = 90 coverage rows`
  disclosure, with 7 operations excluded by product decision. Product exclusion
  is not provider deprecation; never claim all 95 are covered.
- Select `test-console` only when the user asks for a test UI, console, explorer,
  or comparable interactive surface. Do not turn `full-first-wave` into a
  dashboard on its own.
- Select `production-plan` for production architecture or rollout planning. It
  is read-only unless the user separately asks to implement local artifacts.
- Local implementation authorization permits writes only inside the scoped
  project. It never permits sending, uploading, deleting, rotating, changing a
  remote endpoint, or otherwise calling a real provider API.

Read only the selected mode reference:

- `focused` → [references/modes/focused.md](references/modes/focused.md)
- `full-first-wave` → [references/modes/full-first-wave.md](references/modes/full-first-wave.md)
- `full-whatsapp-operations` → [references/modes/full-whatsapp-operations.md](references/modes/full-whatsapp-operations.md)
- `full-supported-operations` → [references/modes/full-supported-operations.md](references/modes/full-supported-operations.md)
- `test-console` → [references/modes/test-console.md](references/modes/test-console.md)
- `production-plan` → [references/modes/production-plan.md](references/modes/production-plan.md)

When scope or completion is material, also read
[references/capability-catalog-summary.md](references/capability-catalog-summary.md)
and [references/coverage-matrix-schema.md](references/coverage-matrix-schema.md).
For multi-domain work, read
[references/handoff-contracts.md](references/handoff-contracts.md).

## Domain routing

| Concern | Owner Skill | Boundary |
| --- | --- | --- |
| API key, trusted-server header, storage, API-key rotation plan | `ycloud-api-authentication` | Never read or validate a real key; generic secret rotation must be disambiguated |
| Direct/queued message send construction or retrieve | `ycloud-whatsapp-messages` | Existing-template sending belongs here; accepted is not final |
| WhatsApp media upload construction | `ycloud-whatsapp-media` | Return a media handoff; upload is not send |
| Template lifecycle and analytics | `ycloud-whatsapp-templates` | Lifecycle is separate from template sending |
| Webhook endpoint management or receiver | `ycloud-webhook-endpoints` | Endpoint management and event receipt remain separate |
| WABA inventory or ACO settings | `ycloud-whatsapp-business-accounts` | Pass opaque WABA identity to Phone Numbers/Messages/Templates |
| Phone registration, profile, username, settings, or commerce | `ycloud-whatsapp-phone-numbers` | Calling settings do not include WhatsApp Calling sessions |
| Group lifecycle, membership, invite links, or settings | `ycloud-whatsapp-groups` | Group management and message final state remain separate |
| Flow lifecycle, preview, publish, deprecate, or delete | `ycloud-whatsapp-flows` | Flow management and Flow message sending remain separate |
| Mark inbound message read or show typing | `ycloud-whatsapp-inbound-messages` | Consume a verified Receiver message identity, not event ID |
| Account balance | `ycloud-balance` | Balance is readiness evidence, not a send/delivery guarantee |
| Contact CRUD, attributes, or notes | `ycloud-contacts` | Contact and note IDs remain distinct; writes are not replay-safe by default |
| Custom event definitions, properties, or ingestion | `ycloud-custom-events` | Definition lifecycle and event acceptance remain separate |
| Customer/channel unsubscribe state | `ycloud-unsubscribers` | Eligibility evidence is not provider send or delivery state |
| WhatsApp Calling session commands or call media | `ycloud-whatsapp-calling` | Command acceptance is not final call state; media is a separate handoff |

Read `references/openapi.md` and `references/runtime.md` for Architect-level
provenance, then load only the selected domain's narrow OpenAPI/runtime
references. Never load the full OpenAPI snapshot by default. For error
translation, retry, idempotency, rate limiting, webhook reliability, or
cross-domain policy, read `references/shared/integration-boundaries.md`. Stop on
source conflict or drift instead of guessing.
When any selected operation lists resources, also read
`references/shared/pagination-contract.md` and preserve its operation-specific
response envelope through client, service, handler, and UI-facing DTO tests.

When the user explicitly asks for sandbox/mock/no-real-side-effect integration
testing or a local YCloud base-URL replacement, also read
`references/shared/sandbox-contract.md`. Keep its provider-shaped surface,
Developer Kit policy, and mock-only control namespace separate; do not count the
Facade as additional OpenAPI coverage or silently substitute it for a real
production-readiness check.

When the user asks for a Java/Node reference project, SDK/Quickstart support,
generated-project evaluation, TTPRI, Beta evidence, or release readiness, also
read `references/shared/reference-integrations.md`. Treat executable paths as
source-distribution assets that may be absent from an installed Plugin. Keep
oracle harness results, caller-supplied candidate evidence, source-bound
receipts, synthetic TTPRI and real Beta evidence as separate trust layers.

## Project work

Inspect only non-secret project structure needed to identify runtime, framework,
build files, server/client boundary, configuration pattern, HTTP client, tests,
and an existing YCloud seam. Reuse the project's architecture and UI framework;
do not introduce React, Vue, Next.js, Spring, or another framework merely because
a test console was requested.

When local writes are authorized, implement the smallest complete vertical seam
for the selected scope and run proportionate no-network tests. Preserve unrelated
and concurrent edits. When writes are not authorized, provide a plan with
concrete project seams and do not change files. Do not apply project changes
unless the user has explicitly authorized local writes for that scoped project.

## Contract rules

- Exact paths, methods, schemas, and descriptions come from the selected
  generated reference. Use placeholders and synthetic IDs.
- `operationId`, codegen extensions, generated model names, and `allOf` do not
  establish an SDK method or new provider behavior.
- Use `runtime.md` for the documented error envelope, request ID, rate limits,
  pagination, compatibility, and asynchronous behavior. Keep provider contract,
  Developer Kit policy, and project decisions visibly separate.
- Include a provider error/request-ID/rate-limit adapter whenever selected
  operations need those cross-cutting runtime behaviors.
- Generate tolerant clients: preserve unknown properties and enum/event values,
  keep explicit unknown response/enum compatibility handling, and treat YCloud
  IDs as opaque case-sensitive strings up to 255 characters.
- Do not invent general idempotency, replay safety, fixed signature tolerance,
  delivery guarantees, or unlisted errors. Treat ambiguous mutation timeouts as
  ambiguous outcomes.

## Orchestration and evidence

Send each owner a handoff containing mode, selected capability IDs, project
seams, authorization level, preconditions, and evidence expected. Require the
domain result to return implemented/deferred/blocked rows, changed artifacts,
tests and results, unknowns, and any outgoing handoff. Merge those results
yourself; do not finish with instructions for the user to invoke every domain
Skill manually.

For `full-first-wave`, account for all 19 rows. For
`full-whatsapp-operations`, account for all 62 rows. For
`full-supported-operations`, account for all 90 rows. A row is not implemented merely
because a menu, card, route name, sample JSON, or button exists. Implemented rows
need a linked adapter/handler/service artifact and behavioral test evidence.
Deferred and blocked rows are allowed only with explicit reasons; silent omissions
fail coverage. Future and product-excluded operations remain disclosure rows and
must never be counted as implemented coverage.

## Outcome requirements

Adapt the response to the selected deliverable instead of forcing fixed headings.
Always make these facts easy to verify:

- normalized scope, deliverable, and mutation level;
- confirmed project facts and source provenance;
- selected capability rows and domain owners;
- architecture and cross-domain handoffs;
- local changes or proposed seams, with no claim that external actions ran;
- tests/evidence and accepted-versus-final state boundaries;
- deferred, blocked, unknown, unsupported, and authorization-gated items;
- next action needed from the user, if any.

### CANNOT

Keep real credentials, customer data, unconfirmed SDK behavior, unsupported
operations, and invented provider guarantees out of the result. Treat real
sends, uploads, deletes, endpoint changes, secret rotations, and production
changes as high-risk external actions. Local-write authorization never permits
them, and this workflow does not execute them.

### Handoff

Return a merged coverage/evidence result to the user. If further work requires a
new project scope, external action, production mutation, or missing material
decision, identify the owner and request that authorization or fact explicitly.
Do not substitute a list of Skills the user must invoke for the merged result.

Use placeholders and synthetic data. Readiness belongs to the smoke Skill.
Repository maintenance, issue tracking, ordinary product explanation, and
support cases remain outside this Skill.
