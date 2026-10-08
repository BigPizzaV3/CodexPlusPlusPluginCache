---
name: ycloud-api-authentication
description: Design, implement locally, or evaluate secure server-side YCloud API authentication with the contract’s X-API-Key scheme, placeholder configuration, environment isolation, secret-manager boundaries, and API-key rotation planning. Use for API-key storage, header, or API-key rotation questions; webhook endpoint secret rotation belongs to Webhooks.
---

# YCloud API Authentication

Design or implement authentication at a trusted server boundary. Use the global authentication scheme in `references/openapi.md` and the official error behavior in `references/runtime.md`. When translating authentication errors or designing rotation coordination, also read `references/shared/integration-boundaries.md` and label project policy separately from YCloud behavior. Never call YCloud, read a credential, or expose a real secret.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Infer the Architect dimensions when they are supplied: `scope`, `deliverable`,
and `mutation`. Without an Architect handoff, default to focused scope and
read-only guidance unless the user explicitly asks to implement local project
changes. Local-write authorization permits server config adapters, validation,
redaction, and no-network tests inside the scoped project. It does not permit
reading, setting, validating, or rotating a real key, changing deployment or
production configuration, or making an external request.

## Scope and handoff

Handle only server-side API-key configuration and API-key rotation planning. A generic "rotate secret" request must be clarified: webhook endpoint secret rotation belongs to Webhooks, not Authentication. Route these requests away:

- Message send/retrieve (including sending an existing template) → `ycloud-whatsapp-messages`.
- Media upload → `ycloud-whatsapp-media`.
- Template lifecycle or analytics → `ycloud-whatsapp-templates`.
- Webhook endpoint management → `ycloud-webhook-endpoints`.
- Broad or multi-domain integration planning → `ycloud-integration-architect`.
- Plugin readiness → the readiness-only smoke Skill; repository-maintenance and issue-tracker workflows are outside this Plugin.

## Workflow

For explicitly requested sandbox/mock/no-real-side-effect tests, also read
`references/shared/sandbox-contract.md`. The fixed synthetic key belongs only to
the local Facade and is not a YCloud test credential or an example of production
key format.

1. Inspect project structure read-only to identify the server runtime, configuration mechanism, deployment environments, and test harness. Do not open or parse secret values from `.env`, credential files, secret stores, logs, shell history, browser storage, or customer data. Ask only for a missing runtime/deployment fact that changes the guidance.
2. Read both narrow references and preserve their exact boundaries. The request header is `X-API-Key`; show only a placeholder such as `<YCLOUD_API_KEY>`, never a user-provided key. An invalid key is documented as HTTP `401` with `error.code=UNAUTHORIZED`; preserve that provider envelope and `YCloud-Request-ID`. If the project exposes RFC 9457, translate only at its own API boundary and retain redacted `provider_code`/`provider_request_id`; never claim YCloud returned Problem Details.
3. Keep the key on a trusted server boundary. Recommend an environment-specific secret injection path or Secret Manager reference, least-privilege access, redaction, and rotation ownership without claiming provider-specific behavior that the contract does not state.
4. Explain environment isolation (development, staging, production), startup/configuration validation that checks presence and shape without printing the value, and tests that use a synthetic placeholder. When local writes are authorized, implement these seams using the project's established configuration pattern and run no-network tests; never inspect the user's environment value.

## Safe examples

Illustrative raw HTTP only; do not execute it:

```http
X-API-Key: <YCLOUD_API_KEY>
```

Illustrative server configuration shape (choose the project’s established mechanism; the value is never supplied here):

```text
YCLOUD_API_KEY=<injected-secret-placeholder>
```

Never place the key in a browser/mobile bundle, client-side storage, a URL/query parameter, source control, a code sample with a real value, analytics, or ordinary request logs. Redact authorization headers in diagnostics.

## Outcome requirements

Adapt the shape to planning, implementation, or evaluation. Make these results
easy to verify:

### Contract

Name the confirmed global `api_key` `apiKey` security scheme with header name `X-API-Key` and cite the generated reference. Distinguish raw HTTP from any SDK/codegen shape.

### Configuration Plan

Describe the server-only injection point, environment separation, access/redaction controls, startup checks, and rotation handoff. Use names and placeholders, not secret values.

### Project Integration

Map the plan to confirmed project modules (HTTP client, config loader, deployment manifest, and tests). If the project cannot be inspected, ask the minimum questions or mark the assumption.

### Tests

Cover header construction with `<YCLOUD_API_KEY>`, missing/blank configuration, environment isolation, redaction, a synthetic `401/UNAUTHORIZED` envelope, and request-ID correlation. Tests must not contact YCloud or inspect a real secret.

### CANNOT

Explicitly refuse to read, echo, validate, rotate, retrieve, or store a real key; call the API; make unrequested local changes or any deployment/production change; put a key client-side, in a URL, logs, or a repository; infer an SDK auth method; or assert unspecified key expiry, rotation overlap, recovery, retry, or endpoint-specific rate behavior. Do not mark the documented `401/UNAUTHORIZED` behavior as unknown. For rotation, describe coordination and confirmation points only.

### Handoff

Send message/media/template/webhook work to its domain Skill. For an Architect
handoff, return `crosscutting:api-authentication` status, project seams, changed
or proposed artifacts, tests and results, unknowns, and the server-side header
boundary. Authentication does not perform the downstream workflow.

## Codegen boundary

Do not infer a Java, TypeScript, Python, Go, or PHP SDK method from `operationId` or model names. Provide a raw HTTP/header example unless the user supplies a confirmed SDK artifact/version and authoritative docs. Treat generated models and schema composition as codegen hints, not additional authentication behavior.
