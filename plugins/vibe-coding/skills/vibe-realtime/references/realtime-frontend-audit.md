# Realtime Frontend Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit the existing query-state library and real-time UI behavior (including TanStack Query when present) across cache identity, mutations, optimistic state, subscriptions, reconnect/offline persistence, rendering, and recovery.

## Domain invariants

- Query keys include every input that changes server state identity and use one stable serialization/factory; tenant/user/auth scope cannot share cache entries accidentally.
- Query functions honor cancellation and return one canonical server-state shape; stale time, garbage collection, retry, refetch, and placeholder/initial data match freshness and UX requirements.
- Mutations update or invalidate exactly the affected keys/entities and reconcile with authoritative server responses rather than duplicating server state into ad hoc local stores.
- Optimistic updates snapshot all affected state, use stable operation identity, handle overlapping/out-of-order mutations, and roll back or reconcile only the failed operation.
- Subscription events carry entity/version/sequence identity, are deduplicated, applied only when newer, detect gaps, and trigger targeted invalidation or full resync when continuity is not proven.
- Focus/reconnect/offline behavior avoids refetch storms, exposes stale/offline state honestly, and scopes persisted cache by user/tenant/schema/version with logout purge and safe hydration.
- WebSocket/SSE client lifecycle has one owner, auth refresh, heartbeat/idle handling, backoff/jitter, online/visibility policy, cleanup, and bounded message buffering.
- Render work is attributed with React Profiler/browser traces and query-cache events; selectors, structural sharing, list virtualization, batching, and event frequency keep commit time and memory bounded.

## Audit method

1. Map user action → query key/function/cache → mutation/optimistic state → server response → subscription event → invalidation/reconciliation → rendered commit.
2. Inventory query keys and all writers/readers/subscriptions for the selected entity; identify duplicate caches and tenant/auth scope changes.
3. Trace overlapping mutation success/failure, delayed response, duplicate/out-of-order event, sequence gap, reconnect, focus, offline hydration, logout/login, and component unmount.
4. Profile representative interaction and sustained event stream using commit duration/count, long tasks, network requests, cache notifications, memory, and reconnect attempts.
5. Separate server/network latency, query scheduling, cache churn, reconciliation, render cost, and browser work before proposing optimization.

## Priority model

- **P0:** cross-user stale data, unsafe duplicate action, unrecoverable state divergence, or critical interface unavailability.
- **P1:** a material cache, optimistic-update, WebSocket/SSE, reconnect, render, memory, or recovery defect.
- **P2:** a lower-risk but concrete responsiveness, diagnostics, or maintainability issue.
