# Source Access-Control Review Patterns

Use this reference to review authorization from application source without
claiming that runtime exploitation occurred. Treat generated inventories,
search matches, call graphs, and framework heuristics as navigation aids only.
Make every security conclusion from the reachable application path and its
application-specific access rule.

## Table of contents

- [Establish the authorization model](#establish-the-authorization-model)
- [Inventory authorization-relevant entrypoints](#inventory-authorization-relevant-entrypoints)
- [Split each operation into obligations](#split-each-operation-into-obligations)
- [Trace enforcement end to end](#trace-enforcement-end-to-end)
- [Test high-value failure patterns](#test-high-value-failure-patterns)
- [Review interface-specific paths](#review-interface-specific-paths)
- [Challenge each candidate](#challenge-each-candidate)
- [Record source evidence](#record-source-evidence)
- [Complete the source review](#complete-the-source-review)

## Establish the authorization model

Before judging any route or function:

1. Identify every subject class: unauthenticated users, owners, peers, roles,
   administrators, support actors, tenants, service accounts, integrations,
   workers, and system processes.
2. Identify owned, tenant-scoped, shared, public, and globally administered
   resources. Include relationship objects such as memberships, invitations,
   assignments, shares, and ownership-transfer records.
3. Identify privileged actions and properties, including role, permission,
   owner, tenant, status, approval, billing, plan, price, and entitlement fields.
4. Extract expected rules from policy code, middleware, domain services,
   repository scopes, database policy, requirements, and explicit application
   documentation.
5. Express each rule as allow, deny, conditional, or unknown. Cite the source
   supporting it and preserve ambiguity instead of inventing intent.

Keep declared labels separate from observed facts. A role name, JWT claim,
route name, UI element, or framework annotation does not prove the effective
caller, owner, tenant, or policy by itself.

## Inventory authorization-relevant entrypoints

Inventory every shipped and reachable path that returns protected data,
changes state, or triggers a privileged effect:

- REST and RPC routes, server actions, and form handlers;
- GraphQL queries, mutations, subscriptions, fields, and nested resolvers;
- administrative, mobile, legacy, beta, and versioned interfaces;
- bulk, import, export, download, upload, and signed-link flows;
- webhooks, integrations, callbacks, queues, workers, schedulers, and jobs;
- notifications, audit logs, metrics, search, reporting, and streaming paths;
- invitation, membership, role-change, tenant-switch, billing, approval, and
  ownership-transfer workflows.

Record public and non-applicable entrypoints with evidence. Do not silently
drop them. Preserve a stable operation identifier and source location for each
entrypoint so grouping cannot hide a sibling route or alternate implementation.

## Split each operation into obligations

Create an independent authorization obligation for every protected element an
operation touches:

- requested function or action;
- primary target object;
- source and destination objects;
- parent and child objects;
- relationship or membership object;
- tenant, organization, workspace, or account boundary;
- sensitive input or output property;
- workflow state transition;
- asynchronous continuation and eventual side effect.

Record every caller-controlled identifier and property from paths, query
strings, headers, cookies, bodies, nested objects, arrays, multipart metadata,
JSON Patch operations, GraphQL variables, and batch inputs. For each one, trace
where its restriction is created, passed, consumed, and applied.

Do not accept a route-level permission such as “may edit projects” as proof
that the submitted project is in scope. Require the final object query or
policy decision to bind the caller to that exact target and action.

## Trace enforcement end to end

Follow the complete reachable path:

`entrypoint -> authentication -> authorization context -> controller/resolver -> service -> repository/query -> serializer/response or state change -> worker/integration`

At every hop:

1. Identify which subject, action, object, tenant, and policy context is used.
2. Verify that caller-controlled identity, owner, role, or tenant values cannot
   replace server-derived context.
3. Verify that a declared or injected scope is actually consumed.
4. Verify that the authoritative query or mutation contains the required owner
   or tenant restriction.
5. Verify that serializers, download handlers, workers, and secondary APIs do
   not re-fetch the object without the same restriction.
6. Check denial, fallback, exception, and empty-filter branches as carefully as
   the normal path.

Continue past the first apparent gap. Search for global middleware, parent
routers, decorators, service policies, ORM scopes, database row policy,
deployment enforcement, and downstream checks that could contradict it.
Likewise, do not accept the existence of a helper or annotation as enforcement
unless the reviewed path invokes it with the correct object and action.

## Test high-value failure patterns

Prioritize these recurring patterns:

| Pattern | Review question |
|---|---|
| Authenticated but not authorized | Does login alone unlock an object or function that needs an owner, role, or tenant decision? |
| Unscoped lookup | Is an object loaded by caller-supplied ID before or instead of an owner/tenant-scoped lookup? |
| Wrong action | Is read/list permission reused for create, update, delete, approve, publish, export, or administration? |
| One-sided relationship check | Are both source and destination, parent and child, inviter and invite, or assigner and assignee independently authorized? |
| Unused restriction | Is a policy filter, tenant scope, or allowed-ID set declared or injected but never applied to the final operation? |
| Empty-filter widening | Can an absent, optional, failed, or empty authorization filter become an unrestricted list, update, or delete? |
| Bulk object mixing | Does a batch authorize the container or first item but omit per-item checks? |
| Mass assignment | Can the caller submit owner, tenant, role, permission, status, price, plan, approval, or entitlement fields that should be server-controlled? |
| Cross-tenant confusion | Can tenant context come from the request, stale session state, object metadata, cache key, or mismatched parent rather than the trusted subject? |
| Alternate-path drift | Does a legacy, public, mobile, admin, import/export, alternate-method, or alternate-parser path omit a control used by its sibling? |
| Downstream re-fetch | Does a worker, serializer, renderer, notification, signed URL, or integration retrieve or act on the target without the original scope? |
| AI/tool delegation | Can an agent, RAG lookup, MCP/tool call, or model-triggered worker use service credentials outside the initiating user's tenant and policy? |
| Workflow bypass | Can a step be skipped, repeated, reordered, or invoked by a different actor to reach a forbidden transition? |
| Stale decision | Is authorization checked before ownership, role, membership, or workflow state changes and then reused after the change? |
| Cache isolation | Can cached protected data or decisions collide across users, roles, or tenants? |

Also review “secondary” surfaces that often escape the main policy path:
search suggestions, counts, error details, audit history, comments, attachments,
exports, previews, background status endpoints, and subscription events.

## Review interface-specific paths

For REST and RPC, compare all real methods, parsers, route versions, singular
and bulk forms, and object-ID carriers. Check method-override behavior only
where the application supports it.

For GraphQL, inspect authorization at operation, resolver, object, and field
levels. Compare direct and nested access, aliases, fragments, wide and narrow
field selections, individual and batched inputs, mutations and their readback,
and subscription filtering. Treat HTTP 200 as transport success only; reason
from returned data, errors, partial results, and actual side effects.

For asynchronous paths, determine whether authorization is re-evaluated at
execution time, whether the job payload can substitute actor or tenant
context, and whether results, callbacks, files, or events are delivered only
to authorized recipients.

## Challenge each candidate

Before retaining a source finding, answer all of these:

1. Which reachable caller-controlled entrypoint starts the path?
2. Which exact object, property, function, or transition is affected?
3. Who owns or controls it, and how is that relationship established?
4. Which application-specific rule requires denial?
5. Which path-specific control is missing, bypassed, or applied to the wrong
   action or object?
6. Which downstream and contradictory controls were checked?
7. What protected data or unauthorized action becomes possible?

Reject or narrow the candidate when the code is dead, test-only, generated,
unshipped, unreachable, safely scoped downstream, intentionally public, or
consistent with documented collaboration or administrator behavior. If owner,
tenant, intent, reachability, or impact remains uncertain, keep a review lead
and write a targeted runtime validation plan.

## Record source evidence

For every retained candidate, record:

- acting subject and required relationship;
- exact entrypoint, action, target, and identifier/property carrier;
- expected rule and its authority;
- complete source path with files, symbols, and relevant line anchors;
- restriction injection, propagation, consumption, and final enforcement;
- missing or bypassed control;
- strongest contradiction checked;
- concrete impact if the path is exercised;
- assurance as source-observed, never runtime-confirmed;
- minimal authorized runtime test needed to validate deployment behavior.

Keep automated search hits and mechanical correlations separate from accepted
evidence. Do not convert a keyword match, absent annotation, status constant,
or framework convention directly into a finding.

## Complete the source review

Before declaring source coverage complete:

- disposition every admitted entrypoint and authorization obligation;
- account for every applicable subject relationship and tenant boundary;
- inspect alternate routes, parsers, versions, bulk forms, GraphQL nesting, and
  asynchronous continuations;
- retain blocked and ambiguous items with exact reasons;
- verify that priority ranking did not remove lower-ranked inventory;
- distinguish reviewed-safe paths from out-of-scope or unreachable paths;
- run an independent challenge pass for omitted objects, wrong policy intent,
  hidden downstream controls, and unsupported impact;
- state that a clean review found no additional proof-gated issue within the
  declared source scope—not that the application is secure.
