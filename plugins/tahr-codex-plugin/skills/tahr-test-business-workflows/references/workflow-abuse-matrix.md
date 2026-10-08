# Workflow Abuse Matrix

Apply only rows supported by the target's actual workflow.

| Abuse family | Questions and variants |
|---|---|
| Data trust | Can the client set price, total, discount, tax, quantity, balance, credit, fee, owner, tenant, role, status, approval, verified, entitlement, or plan? Test omitted, negative, zero, extreme, wrong type, nested, array, duplicate, and extra-property forms. |
| State machine | Can a later step run directly? Can steps be skipped, reordered, repeated, resumed under another actor/tenant, or called after cancellation/expiry? |
| One-time artifacts | Can invite, coupon, reset, approval, idempotency, nonce, state, or confirmation artifacts be replayed, reused across actors, or used after the underlying state changes? |
| Concurrency | Can duplicate redemption, creation, transfer, booking, voting, claim, approval, or quota consumption succeed concurrently when sequential attempts do not? |
| Limits | Do repeated valid business successes evade per-user, object, tenant, IP, device, version, batch, alias, or alternate-endpoint limits? |
| Property security | Are privileged input properties persisted? Do list/detail/search/export responses expose fields the actor should not receive? |
| Alternate interface | Does method, content type, API version, mobile/legacy route, bulk endpoint, GraphQL alias/batch, or asynchronous job apply weaker validation? |
| Third-party trust | Does the application trust redirects, status, content type, fields, or oversized responses from fetch/import/payment/shipping/identity providers? |
| Webhook/integration | Can an actor register/update a target, bypass signature/timestamp/replay checks, forge an event, or cause an unauthorized downstream transition? |
| File workflow | Do filename, metadata, type, magic bytes, archive contents, processing, preview, render, and download stages enforce the same policy? |
| Generated links/routing/cache | Can host/proxy/header inputs influence reset/invite links, redirects, routing, tenant selection, shared cache keys, or customer-visible content? |

## State-machine worksheet

For each transition record:

- current state and authoritative source;
- allowed actor/role/tenant and object owner;
- prerequisites and one-time artifacts;
- request operation and client-controlled fields;
- expected next state and side effects;
- direct, reordered, repeat, stale, alternate-actor, and concurrent variants;
- readback/control operation;
- cleanup or compensating action.

## Race discipline

Use only disposable, reversible operations. Establish sequential controls first. Synchronize the smallest useful batch, preserve every result, count confirmed business effects, and stop on instability. Multiple HTTP 2xx responses do not prove a race unless authoritative state shows an invariant violation.
