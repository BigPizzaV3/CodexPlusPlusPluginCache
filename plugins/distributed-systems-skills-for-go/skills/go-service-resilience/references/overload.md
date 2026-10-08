# Overload and recovery

## Queueing

When arrival rate exceeds completion rate, queues grow until bounded by memory or timeout. Long queues increase work discarded after deadlines and hide overload behind latency. Prefer a short explicit queue with rejection over an unbounded channel.

## Load shedding

Reject before expensive parsing, allocation, or downstream calls. Keep the rejection path cheap and observable. If clients may retry, provide a stable overload signal and coordinate with retry budgets.

## Concurrency limits

Static limits are predictable but require capacity knowledge. Adaptive limits can track latency but add a control loop that must be tested under noise and recovery. In either case, acquire capacity before starting work and preserve fairness for critical traffic.

## Circuit recovery

Allow a bounded number of probes and add jitter to reopen timing. A half-open stampede can immediately re-overload a recovering dependency. Per-instance breakers do not coordinate globally; a shared breaker adds its own consistency and availability dependency.

## Degradation

Prefer explicitly lower-quality but correct results. Returning stale or partial data without marking it can violate user or financial semantics. Define which fields/features may degrade and how callers observe it.

## Capacity caches

If the origin cannot survive a cold-cache miss storm, the cache is a capacity dependency. Plan warmup, request coalescing, stale-while-revalidate bounds, and origin protection. Test loss of the cache, not only cache hits.
