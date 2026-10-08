---
name: tahr-map-attack-surface
description: Map the real security-relevant surface of a web application or API from source, specifications, JavaScript, browser behavior, and authorized traffic. Use for pre-pentest reconnaissance, security-review scoping, hidden route or parameter discovery, undocumented API inventory, role-aware surface comparison, or judging whether an existing review actually covered the application.
---

# Map the Attack Surface

Build an evidence-backed inventory before testing vulnerabilities. Treat every discovered item as coverage evidence, not as a finding.

## Set the boundary

1. Identify the repository roots, application origins, API origins, environments, and supplied specifications or traffic captures.
2. Record the allowed runtime scope. Do not contact a live target unless the user supplied it or clearly authorized testing it.
3. Default to source-only analysis when authorization, credentials, or a runnable environment are absent.
4. Keep runtime activity read-only and low volume. Do not submit destructive forms, create real orders, send invitations, modify accounts, or enumerate unrelated infrastructure.
5. Never print or persist passwords, cookies, bearer tokens, API keys, reset links, private keys, CSRF values, or user PII. Retain names, locations, value classes, lengths, and short SHA-256 fingerprints when useful.

## Inventory independent evidence sources

Inspect each available source independently before merging:

- server routes, controllers, RPC handlers, middleware, authorization declarations, background jobs, queues, and WebSocket/SSE handlers;
- OpenAPI, Swagger, GraphQL schemas and documents, generated clients, protobufs, and API examples;
- frontend routes, forms, fetch/axios clients, lazy chunks, source maps, feature flags, upload configuration, storage keys, and custom headers;
- infrastructure routes, reverse-proxy rules, serverless functions, storage buckets, callback handlers, and public documentation;
- authorized unauthenticated and authenticated browser/API traffic, separated by identity, role, and tenant.

Do not infer reachability from a route name alone. Mark each operation as source-derived, documented, browser-observed, traffic-observed, or runtime-confirmed.

## Build canonical operations

Read [surface-inventory.md](references/surface-inventory.md) and create one record per meaningful operation. Preserve:

- protocol, origin, method or operation type, path, content type, and request shape;
- query, path, body, header, cookie, form, multipart, and GraphQL variable fields;
- authentication state, identity/role/tenant context, object identifiers, owner hints, and workflow state;
- response class, state-changing behavior, source artifact, and confidence.

Do not merge operations when method, body shape, parser, auth state, role, tenant, owner, response behavior, or workflow state differs. Preserve exact endpoint-to-field provenance; a global parameter list is insufficient.

## Prioritize attacker-relevant surface

Rank concrete operations higher when they expose:

- login, reset, MFA, invite, token, session, or account lifecycle behavior;
- admin, role, tenant, membership, ownership, billing, entitlement, approval, or settings functions;
- object IDs in any carrier, bulk/composite IDs, exports, downloads, or sensitive response fields;
- upload, import, preview, render, conversion, callback, webhook, URL-fetch, or integration behavior;
- price, total, quantity, discount, status, state, owner, tenant, role, or idempotency fields;
- HTML/Markdown/template input, search/filter/sort expressions, file paths, XML, or serialized data;
- undocumented versions, hidden client routes, debug endpoints, source-map leads, or role-specific discrepancies.

Priority controls review order only. Do not discard lower-ranked operations.

## Close coverage gaps

Read [coverage-gates.md](references/coverage-gates.md). Assign every discovered item one terminal state: `visited`, `runtime_confirmed`, `source_only`, `queued`, `partially_explored`, or `skipped_with_reason`.

When discovery is unexpectedly shallow, perform one bounded second pass using a different evidence source: follow lazy routes, inspect request builders, parse schemas, expand safe UI elements, or compare another supplied identity. Never describe absent evidence as proof that a feature is absent.

## Deliver the inventory

Report:

1. scope and evidence sources inspected;
2. canonical operations grouped by trust boundary and identity context;
3. high-value targets with exact provenance;
4. identity, tenant, object, upload, callback, and workflow maps;
5. coverage gaps, blocked areas, and the consequence of each gap;
6. candidate hypotheses clearly labeled as unverified.

Do not assign vulnerability severity from recon alone. Recommend the appropriate Tahr testing skill for each candidate class.
