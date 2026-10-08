# Performance Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Find reachable performance problems that affect user experience, throughput, cost, reliability, or operational stability. Keep issues where current repository evidence shows a concrete hot path or high-risk path.

## Inspect

Routes/pages/components, handlers/services, database queries, migrations/indexes, caches, background jobs, queues, external calls, build/bundle config, assets, SSR/ISR/static generation, telemetry, tests/benchmarks, CI, and docs.

## Issue classes

- Database: N+1 queries, missing indexes for common filters/joins/sorts, unbounded scans, transaction scope, pagination/cursor inefficiency.
- API/server: blocking I/O, serial external calls, synchronous heavy work in request path, missing caching for stable expensive data, retry storms.
- Frontend: unnecessary client waterfalls, bundle bloat, heavy hydration, repeated expensive renders, large assets, missing lazy loading where repo patterns support it.
- Background jobs: duplicate work, unbounded queues, inefficient polling, non-idempotent retries, job amplification.
- Build/deploy/runtime: cold-start cost, memory spikes, cache invalidation drift, health checks that mask degraded service.
- Observability/testing: performance assumptions contradicted by code, missing guard tests/benchmarks for a critical path when a harness exists.

## Priority model

Performance issue that can cause outage, data loss, severe critical-path failure, request collapse, or runaway cost in a reachable production path.

Hot-path latency/cost/reliability issue with clear user or operational impact.

Lower-risk but real inefficiency that affects maintainability, future scaling, or a non-critical but reachable path.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the problematic behavior/contract and the owner layer, plus symbol when possible.
- Include reachable surface, affected actors/consumers/states, expected behavior, acceptance criteria, and validation direction when discoverable.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same behavior owner/source of truth unless fixes, rollout units, or validation differ.
- Do not report theoretical risks, stylistic preferences, or generic best practices without current repo impact.
- Explain impact from repo-visible reachability and mark inferred traffic/scale assumptions clearly.
- Prefer owner-layer fixes: query/index/pagination/caching/job structure/source-of-truth, not cosmetic local tweaks.
- If validation commands/benchmarks are absent, specify observable checks that an execute run can add or perform.
