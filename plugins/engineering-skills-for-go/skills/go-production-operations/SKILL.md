---
name: go-production-operations
description: "Use for Go process/deployment lifecycle, health, telemetry, drain, Kubernetes, and releases. Do not use for domain logic."
license: Apache-2.0
compatibility: "Go 1.24 or newer; deployment-platform behavior must be verified against the active environment."
---

# Go production operations

Startup, readiness, telemetry, overload signals, and shutdown are externally observable service behavior.

## Startup

Parse and validate configuration before serving. Distinguish required secrets, immutable startup settings, and safely reloadable values. Every reload validates a complete candidate snapshot before atomic publication and retains the last known-good state on failure. Initialize dependencies in ownership order and return startup errors from a testable `run` path rather than hiding work in `init`.

## Telemetry

Use structured events with stable names and bounded fields. Metrics labels must have bounded cardinality. Propagate trace context across supported protocols, record errors without secrets, and correlate request identity without treating it as authorization. Define signals for success, rejection, overload, dependency failure, retry, ambiguity, and degraded behavior.

Make telemetry export a bounded failure domain. Choose queue and batch limits, drop or sampling policy, request-path blocking behavior, exporter deadlines, and shutdown flush budget explicitly. Exporter outage must not create unbounded memory or stall the service indefinitely. Expose dropped records, queue saturation, sampling, and export failure through an independent bounded signal; absence of backend data is otherwise indistinguishable from a quiet system.

## Health and overload

Readiness means the instance can safely accept its intended traffic. Liveness means restart is likely to restore progress. Do not make liveness fail for every downstream outage. Keep probes cheap and reserve enough capacity for diagnosis and drain.

## Shutdown

On termination: stop or mark admission, drain accepted work, stop background producers, wait within the platform budget, flush bounded telemetry, and close dependencies after their users. Surface forced termination and abandoned work.

Use `go-service-boundaries` as well when shutdown correctness depends on HTTP bodies, streams, protocol draining, or client/server resource ownership.

## Delivery

Build reproducibly, pin CI inputs, generate checksums and provenance, scan archives, run as a non-root minimal image where practical, set realistic resources, and design rolling updates for mixed versions and rollback.

Read [references/incident-contract.md](references/incident-contract.md) for lifecycle, cardinality, backpressure, and telemetry-loss traps.

For staged deployment, controller progress, canary evidence, data migration, and rollback safety, read [references/rollout-and-rollback.md](references/rollout-and-rollback.md). Platform availability is necessary rollout evidence, not proof that the new artifact preserves business or data invariants.

## Output contract

State the lifecycle order, deployment assumptions, and signals that prove each state. Avoid copied Kubernetes or logging templates without causal fit.
