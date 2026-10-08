# Rollout and rollback

A deployment controller reconciles replicas and availability. It cannot decide whether a new artifact computes the right result, preserves financial integrity, or remains compatible with data written during the rollout. Treat deployment progress, service correctness, and data migration as separate state machines.

## Identify the generation

Attach an immutable generation to every observation:

- source commit and reproducible artifact digest;
- configuration, feature-policy, secret, and schema generation;
- deployment revision, region, cohort, and instance;
- migration or backfill generation when data changes.

Do not use an image tag or mutable ConfigMap name as sufficient identity. Aggregate metrics without cohort identity can hide a failing canary behind the stable population.

## Define admission and progress

Readiness proves only that this instance may safely receive its intended traffic now. Keep it cheap and specific to admission-critical state. A startup probe can protect slow initialization from liveness restarts; liveness should represent a condition restart can plausibly repair.

Kubernetes Deployment `Available` and `Progressing` conditions reflect replica and readiness progress. A progress deadline reports a stall; the Deployment controller continues retrying and does not itself roll back. `maxUnavailable`, `maxSurge`, readiness delay, termination grace, autoscaling, disruption, and real headroom together determine rollout capacity.

Define a separate rollout gate with:

1. a bounded cohort and exposure method;
2. minimum traffic or event volume and observation duration;
3. technical signals such as errors, latency, saturation, restarts, queue age, and dependency load;
4. domain signals such as invariant violations, duplicate effects, reconciliation breaks, and support-visible regressions;
5. missing-telemetry behavior and an independent operator path;
6. pause, abort, expand, and emergency-forward-fix authority.

A single successful probe or request is not sufficient canary evidence. Avoid thresholds that merely compare noisy point estimates; state the baseline, window, minimum sample, material regression, and low-traffic policy.

## Preserve mixed-version behavior

Assume old and new instances overlap during rollout, scale changes, delayed termination, and rollback. Verify both directions for requests, stored rows, messages, caches, configuration, and external side effects. A readiness gate cannot repair a protocol or schema that is incompatible across generations.

For storage or durable messages, separate code rollout from expand/migrate/contract:

1. expand readers and storage so old and new writers are accepted;
2. deploy compatible writers;
3. backfill with checkpointed, replay-safe evidence;
4. prove old representations are no longer produced or required;
5. contract only after rollback to old code is intentionally impossible.

Feature flags change behavior but do not create schema compatibility. Version and audit flag decisions; test partial rollout and stale configuration.

## Decide whether rollback is real

Kubernetes Deployment rollback restores the recorded Pod template revision. It may not restore an external ConfigMap, Secret, database state, message schema, cache content, provider action, or irreversible business effect. Before enabling automatic rollback, prove that the old artifact can read every value written by the new one and that reverting traffic cannot duplicate or contradict effects.

When the new version has emitted irreversible effects or contracted data, forward repair, quarantine, or reconciliation may be safer than binary rollback. Record the chosen authority and residual exposure rather than presenting rollback as transactional undo.

## Preserve release evidence

Retain the generation manifest, rollout plan, preconditions, cohort allocation, metric and domain queries, raw decision windows, pauses, approvals, migration positions, termination failures, rollback or forward-fix decision, and reconciliation outcome. A dashboard screenshot without query, cohort, time range, and artifact identity is weak evidence.

Exercise failed readiness, partial capacity, low traffic, telemetry outage, old/new protocol overlap, termination past grace, migration interruption, rollback after a new-format write, and irreversible external effects. The output must state which platform facts are observed and which application invariants remain to be proven.
