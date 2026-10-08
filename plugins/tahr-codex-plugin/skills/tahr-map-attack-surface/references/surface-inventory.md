# Surface Inventory

Use this schema conceptually; adapt it to the user's requested output format.

## Canonical operation record

| Field | Record |
|---|---|
| Identity | Stable operation key; protocol plus method/operation plus normalized path |
| Transport | HTTP, GraphQL, WebSocket, SSE, gRPC, job, queue, or browser-only action |
| Request | Origin, method, path, content type, query names, body shape, headers, cookies, and file fields |
| Security context | Public/authenticated, identity label, role, tenant, owner/object relationship, and required precondition |
| Behavior | Read or state change, response class, redirect, parser, and downstream processing |
| Provenance | Exact file and symbol, specification operation, browser action, or captured request |
| Confidence | Source-derived, documented, observed, or runtime-confirmed |
| Coverage | Visited, source-only, queued, partially explored, or skipped with reason |

## Preserve meaningful variants

Keep separate records when any of these differ:

- method or GraphQL operation;
- body fields, nesting, arrays, content type, or parser;
- public, authenticated, role, tenant, or owner context;
- response status or behavior class;
- workflow step or state-changing effect;
- API version or alternate frontend/backend origin.

Normalize scheme and host casing, fragments, trailing slashes, query ordering, and obvious cache-busters only. Keep a safe redacted example and the reason for every merge.

## Extract high-value relationships

Build explicit lists for:

- identity endpoints and login/session transitions;
- roles, permissions, tenants, organizations, accounts, and workspaces;
- owner/object identifiers and where each identifier appears;
- create, read, update, delete, list, export, and bulk operation families;
- multi-step workflows and hidden state or idempotency fields;
- upload initiation, storage, completion, preview, render, and download stages;
- callback, webhook, redirect, import, fetch, conversion, and third-party trust boundaries.

Redact values, not structure. Preserve field/header names, type, source, length, and fingerprint.
