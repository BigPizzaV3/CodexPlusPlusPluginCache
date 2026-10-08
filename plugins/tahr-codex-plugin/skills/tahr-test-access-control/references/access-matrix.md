# Access-Control Matrix

Use the matrix to prove complete, comparable authorization coverage. It is a
behavior and source-review ledger—not a vulnerability engine.

## Contents

- [Subject relationships](#subject-relationships)
- [Operation inventory](#operation-inventory)
- [Authorization obligations](#authorization-obligations)
- [Identifier and property carriers](#identifier-and-property-carriers)
- [Interface and workflow variants](#interface-and-workflow-variants)
- [REST comparison rules](#rest-comparison-rules)
- [GraphQL comparison rules](#graphql-comparison-rules)
- [Asynchronous and indirect paths](#asynchronous-and-indirect-paths)
- [Matrix requirement records](#matrix-requirement-records)
- [Grouping and proportionality](#grouping-and-proportionality)

## Subject relationships

Model each relationship only when it exists, and record why any lane is not
applicable.

| Caller | Target relationship | Required question |
|---|---|---|
| Unauthenticated | Protected resource or function | Is authentication enforced at the authoritative backend? |
| Same identity | Own resource | Does the authorized control establish valid request and response semantics? |
| Same-role peer | Another identity's resource | Is ownership enforced independently of role? |
| Lower privilege | Privileged function or property | Is function/property authorization enforced on every equivalent path? |
| Cross-role | Resource or action owned by another role | Does the policy allow the relationship, or is privilege confused with ownership? |
| Cross-tenant peer | Other tenant/domain resource | Is tenant/domain scope derived from trusted context and applied at the sink? |
| Higher privilege | Lower user's private resource | Does administrator/support scope match actual policy rather than assumed omniscience? |
| Service/integration | Human or administrative function | Are audience, scope, actor type, and resource domain enforced? |
| Worker/job | Deferred user action | Is initiating identity and resource scope preserved across the queue boundary? |

Do not create a peer or cross-tenant success claim when caller and owner are the
same identity, or when both sides have the same/unknown tenant. Preserve the
cell as needing proof instead.

Use `own` only when the matrix caller equals the recorded owner of every
owner-attributed target in that cell. An ownerless tenant/domain collection may
use `own` only when its tenant and authorization domain exactly match the
caller. An administrator acting on another identity's object is normally
`privileged_to_private` (or another policy-specific relationship), not `own`
merely because the administrator is allowed.

## Operation inventory

Include all admitted authorization-relevant operation kinds:

- REST routes and alternate methods;
- GraphQL queries, mutations, subscriptions, nested resolvers, aliases, and
  batching behavior;
- RPC, server actions, WebSocket messages, SSE, and real-time channels;
- UI-triggered backend functions and direct URLs;
- webhooks, callbacks, integrations, signed-URL issuers, and download paths;
- jobs, queues, workers, schedulers, and asynchronous continuations;
- bulk, import, export, report, audit, metric, search, and administrative paths;
- current, legacy, beta, mobile, internal, public, and versioned equivalents.

Record intentionally public and non-authorization-relevant operations in the
surface inventory with evidence. Do not simply exclude them from counts.

## Authorization obligations

Split a single operation into multiple obligations whenever it touches more
than one protected target. Typical obligations include:

- source object and destination object for clone, move, merge, copy, or transfer;
- parent and child for attachments, comments, members, tasks, or nested routes;
- relationship object for invitations, memberships, sharing, and role grants;
- each resource in a bulk/composite request;
- object permission and sensitive property permission;
- initial request and worker/job continuation;
- stored artifact and later download or renderer path;
- root GraphQL field and nested object/field resolvers.

For each obligation, record:

1. caller-controlled identifier/property carriers;
2. required action;
3. expected policy rule;
4. restriction source, such as authenticated tenant or owner relation;
5. propagation through parameters and service calls;
6. authoritative enforcement point;
7. query, state change, disclosure, or side effect;
8. downstream or compensating control checked;
9. status: enforced, partial, missing, bypassable, or unknown.

Permission to perform an action somewhere does not prove permission on the
submitted target. Authorization on a parent does not automatically authorize a
separately supplied child.

## Identifier and property carriers

Freeze every carrier present in real source, schemas, requests, or traffic:

- path and query parameters;
- JSON, form, XML, and multipart fields;
- nested objects, arrays, maps, and bulk/composite IDs;
- headers and cookies that carry actor, owner, account, tenant, organization,
  workspace, role, or object context;
- JSON Patch paths and values, merge patch, and DELETE bodies;
- GraphQL variables, input objects, aliases, fragments, directives, nested
  selections, global IDs, relay nodes, and batch entries;
- filenames, metadata, storage keys, signed URL claims, job payloads, and event
  attributes;
- response fields whose visibility differs by role or relationship.

High-value authorization-sensitive properties include `id`, `user_id`,
`owner_id`, `account_id`, `tenant_id`, `organization_id`, `workspace_id`,
`member_id`, `role`, `permissions`, `is_admin`, `status`, `approved`,
`verified`, `price`, `credit`, `plan`, `entitlement`, and comparable
application-specific fields.

Do not spray generic field names. Use carriers evidenced in this target and
record how each reaches a policy decision or sink.

## Interface and workflow variants

Freeze variants that can reach distinct routing, parsing, policy, or service
layers:

- GET/POST/PUT/PATCH/DELETE and supported method overrides;
- JSON, form, multipart, JSON Patch, XML, GraphQL, and other advertised parsers;
- trailing slash, case, normalization, or alternate action routes only when
  distinct handlers or middleware may apply;
- current, mobile, legacy, beta, internal, public, and alternate API versions;
- singular, bulk, import, export, download, async, and scheduled equivalents;
- direct URL, reordered workflow step, stale-state action, repeated action,
  alternate actor, and cross-tenant continuation;
- authenticated, public, admin, support, and service variants;
- read/list/search/audit/log/notification equivalents that expose the same
  protected object or relationship.

Ranking determines order. It never removes a frozen variant from coverage.

## REST comparison rules

Pair each unauthorized case with a valid control using the same:

- method and route template;
- parser and content type;
- request body shape;
- resource type and lifecycle state;
- API version;
- non-authorization parameters;
- target environment and application revision.

Change one authorization dimension: caller, owner/tenant target, privileged
action, or sensitive property. Record every unavoidable additional difference.

A status-code difference can help choose follow-up. It cannot prove protected
data, policy, ownership, or persistent state. Treat redirects, cache behavior,
rate limits, validation errors, generic shells, and resource absence as
possible confounders.

## GraphQL comparison rules

Inspect GraphQL `data`, `errors`, partial data, and null placement instead of
using HTTP 200 as a verdict. Freeze coverage for:

- root queries and mutations;
- nested object and field resolvers;
- aliases requesting multiple owners or tenants;
- fragments and directives that reveal role-dependent fields;
- individual versus batched/global-ID access;
- mutation input properties and authoritative readback;
- subscriptions that must deliver an actual unauthorized event before impact
  is proven;
- introspection or schema visibility separately from protected execution.

A visible type or mutation name is not function-level impact. Prove protected
data returned, privileged logic executed, or forbidden state persisted.

## Asynchronous and indirect paths

Continue the authorization trace across:

- queue payload creation and consumption;
- user/tenant context serialization and rehydration;
- retry and dead-letter handling;
- report/export generation and later download;
- notifications, audit records, metrics, and activity feeds;
- webhooks and third-party callbacks;
- storage keys, signed URLs, caches, search indexes, and replicas;
- worker-to-service or service-to-service calls.

An API returning 202 proves only acceptance. Require downstream state,
protected artifact creation, delivery, or other authoritative side effect.

## Matrix requirement records

For each operation, create one matrix requirement that lists:

- required caller identity IDs;
- required relationship values;
- required obligation IDs;
- required carrier IDs;
- required variant IDs;
- source review requirement;
- runtime test requirement;
- risk if not reviewed.

The corresponding matrix cells must collectively cover every required caller
and relationship. Create the application-meaningful caller/relationship tuples
explicitly; do not infer an artificial Cartesian product when a relationship
cannot apply to a caller. Carrier and variant coverage may be represented by
one cell only when the cell names all covered values and the enforcement path
is truly equivalent.

Keep blocked cells. Use precise reasons such as `missing_peer_identity`,
`missing_owner_attributed_object`, `runtime_not_authorized`,
`non_disposable_target`, or `parser_unavailable`. Generic reasons such as
“time” or “not tested” do not disposition coverage.

## Grouping and proportionality

Avoid a route-by-route wall of repeated prose. Reuse identities, resources,
policy rules, enforcement points, claims, and validation tests.

Group operations only when all of these match:

- subject/relationship policy;
- resource and action;
- identifier and property carriers;
- enforcement point and downstream continuation;
- relevant variants and risk;
- evidence revision.

If any member has a legacy/public/admin handler, different parser, bulk
behavior, child object, sensitive property, or asynchronous path, split it or
record a separate obligation and cell. Concision must not erase a distinct
authorization decision.
