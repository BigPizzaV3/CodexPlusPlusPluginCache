# Overload signals and scope

An admission limit is meaningful only with a named resource, scope, and enforcement point. A limit of 100 active requests per process permits 10,000 across 100 replicas and changes again during autoscaling. State whether the invariant is per connection, process, zone, dependency, tenant, method, or fleet, and reconcile local fast-path limits with any distributed quota.

## Reject before consuming the scarce resource

Bound request bytes and unauthenticated work at the edge. Establish authenticated tenant and service identity before trusting caller-supplied priority, quota keys, or exemption headers. Then admit before expensive decoding, large allocation, goroutine creation, queueing, database acquisition, or dependency calls. Keep rejection cheap enough to survive the overload it reports.

Queue capacity is a memory and latency budget, not a second admission system. Include queued operations, active attempts, callers sleeping in backoff, streams, and background work in the relevant resource model. If priorities exist, reserve capacity or use fair scheduling from an authenticated class; prevent low-priority floods from starving health, cancellation, settlement, or other control work, while preventing an unrestricted priority class from starving everyone else.

## Preserve protocol meaning

Choose an overload response from the actual protocol contract. HTTP 429 represents rate limiting and can carry `Retry-After`; HTTP 503 represents temporary service unavailability and can also carry `Retry-After`. gRPC distinguishes resource exhaustion from unavailability, while a deadline can still leave a state-changing outcome ambiguous. Do not flatten quota, capacity, maintenance, timeout, and permanent rejection into one generic retryable error.

`Retry-After` is a hint, not authority to exceed the caller's deadline or local retry budget. It can be delay seconds or an HTTP date; parse defensively, account for clock uncertainty, cap it locally, and retry only replay-safe operations under the designated retry owner. A client, proxy, mesh, and SDK must not each convert one overload signal into independent retries.

## Make fleet behavior recoverable

Local admission must converge with fleet and dependency capacity. A centralized limiter can coordinate a global quota but becomes another latency, consistency, and availability dependency; define its failure mode. A local limiter remains available but needs allocation, rollout, and autoscaling semantics so replica count does not silently create capacity.

Degraded responses must remain semantically distinguishable from authoritative success. A stale cache, partial result, or omitted optional feature is safe only when the caller contract permits it and downstream systems cannot mistake it for current complete data.

Observe original operations, attempts, accepted and rejected work by stable bounded class, queue time, service time, concurrency, shed reason, retry hints, client compliance, dependency saturation, and recovery ramp. Test partial capacity, hot tenants, malicious priority headers, limiter failure, autoscaling, synchronized clients, and cold recovery—not only steady overload.
