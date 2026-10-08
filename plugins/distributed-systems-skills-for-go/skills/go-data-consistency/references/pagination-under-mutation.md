# Pagination under mutation

A cursor is a continuation contract, not merely a base64-encoded row value. Keyset pagination avoids the shifting work and position ambiguity of large `OFFSET` queries, but it is stable only relative to an explicit order, mutation policy, and read authority.

## Establish a total order

Define a deterministic total order whose last component is unique. For example, `ORDER BY created_at DESC, id DESC` uses `id` to order rows that share a timestamp. Specify direction, collation, and null placement for every component. The next-page predicate must be the lexicographic continuation of that exact order over every component; mixed directions or nullable keys require an expanded predicate rather than an assumed tuple comparison.

Fetch at most the bounded page size plus one row to establish `has_more`. Keep filters selective and support the order with an appropriate index after measuring the deployed query. Keyset pagination does not guarantee a faster plan for every filter or data distribution.

An order such as `created_at` alone is not total. A cursor containing only that value can duplicate or skip peers even without concurrent writes.

## Choose the cross-page contract

State one of these contracts to the client:

- **Live traversal:** each page observes the current authorized view after the last boundary. Inserts before the boundary may not appear; deletes disappear; and updates that move a row across the sort boundary can duplicate or skip it. This is often acceptable for feeds, but the behavior is part of the API.
- **Stable snapshot or watermark:** every page is evaluated against one logical data version. Implement this with an evidence-bearing database snapshot, durable watermark, materialized result, or version predicate whose retention and failover behavior are defined. Do not keep a database transaction open across arbitrary client think time or expose a raw database snapshot identifier without accounting for authorization, resource retention, expiry, and topology.

PostgreSQL Read Committed gives successive commands new snapshots. Switching from `OFFSET` to a keyset predicate does not turn separate requests into one stable snapshot. Higher isolation inside one transaction also does not establish a cross-request API contract unless the transaction or equivalent version is deliberately retained.

If the order key is mutable, either accept the documented live-view anomalies, paginate by an immutable ordering key, or pin a stable data version. No cursor encoding can repair an unstable source order.

## Bind the cursor to its authority

An opaque cursor should carry or resolve all state needed to reject a semantically different continuation: tenant or authority scope, normalized filters, sort and null policy, API/schema version, boundary values, page-size policy, snapshot or watermark when used, source or failover generation when positions are topology-specific, and expiry.

Authenticate the cursor when client modification could widen access, change the query, or create pathological work; encrypt it only when its contents are also sensitive. Base64 is an encoding, not integrity protection. Still reauthorize the current principal and resource on every request—a valid old cursor is not an authorization grant.

Reject malformed, expired, filter-mismatched, version-incompatible, and topology-incomparable cursors distinctly enough to operate the system without exposing sensitive internals. Bound decoded size and parsing work.

## Account for replicas and cutover

Do not continue a cursor on an arbitrary replica unless its replay position satisfies the cursor's data-version contract. Bind source positions to the cluster or timeline generation that makes them comparable. After failover, either prove the new authority contains the required version, restart under the documented live-view semantics, or return an explicit stale-cursor result; silently interpreting an old position against a new history can omit or repeat rows.

Test equal sort keys, nulls, inserts and deletes around the boundary, sort-key updates, filter and tenant tampering, expiry, index-plan regressions, replica lag, and failover. Assert the promised contract—live traversal or stable snapshot—rather than the weaker property that each individual page is sorted.

Primary evidence: [PostgreSQL sorting](https://www.postgresql.org/docs/current/queries-order.html), [PostgreSQL `LIMIT` and `OFFSET`](https://www.postgresql.org/docs/current/queries-limit.html), and [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
