# Incident contract

An operator should be able to distinguish:

- no admission versus slow processing;
- caller cancellation versus internal deadline;
- dependency rejection versus local overload;
- retry attempts versus original operations;
- known failure versus ambiguous outcome;
- unready drain versus crashed process;
- dropped telemetry versus no events.

During recovery, ramp traffic, retries, reconnects, and cache fill so the recovery path does not reproduce overload.

## Telemetry under failure

- Bound metric label domains; a tenant, user, raw URL, request ID, or error string can create an unbounded series set.
- Bound exporter queues and batches. Decide whether request-path emission drops, samples, or blocks, and cap any blocking with the operation budget.
- Count dropped, truncated, sampled, and rejected telemetry outside the failing export path where possible.
- Treat logs, metric attributes, span events, and exception bodies as data egress paths subject to classification and size limits.
- Flush within the shutdown budget. Do not close the exporter while owned producers can still enqueue, and do not let an unreachable collector block process exit indefinitely.
