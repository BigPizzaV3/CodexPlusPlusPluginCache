# Performance Budget Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Find concrete performance-budget risks and regression gaps in hot paths, especially where latency, throughput, memory, bundle size, database cost, provider cost, or job duration can grow without a guardrail.

## Inspect

Hot routes/pages/actions, rendering boundaries, data fetching, database queries/indexes, API fanout, caches, job loops, provider/model calls, assets, bundling, CI, existing benchmarks, logs/metrics, SLO docs, and release checks.

## Focus areas

- No explicit or testable budget for a repo-visible hot path where the code already implies a latency/size/cost expectation.
- Unbounded input/output cardinality: page sizes, loops, query result sets, job batches, exports, OCR/RAG/model chunks, assets, or in-memory aggregation.
- Waterfalls and fanout: serial awaits, N+1 provider/database calls, repeated expensive renders, cache misses, or avoidable round trips.
- Memory and artifact growth: retained buffers, full-file loads, large bundle chunks, uncompressed assets, or generated artifacts that scale with user data.
- Cost amplification: model/provider calls, retries, polling, cron overlap, background reprocessing, or analytics/events that scale faster than the user action.
- Regression visibility gaps: missing benchmark/test/CI/log metric where an existing harness could enforce the hot-path budget.

## Priority model

Issue that can cause outage, data loss, duplicate irreversible side effects, tenant/privacy breach, severe critical-path failure, request collapse, or runaway cost in a reachable production path.

Hot-path reliability, consistency, concurrency, or performance issue with clear user, business, operational, or cost impact.

Lower-risk but real issue that affects maintainability, future scaling, diagnosability, or a non-critical but reachable path.

## Evidence rules

- Keep only concrete, reachable findings supported by current repository evidence.
- Cite `path:line[-line]` evidence for the problematic behavior/contract and the owner layer, plus symbol when possible.
- Distinguish direct repository facts from assumptions about traffic, scale, deployment, users, providers, or operations.
- Merge symptoms under the same owner/source of truth unless fixes, rollout units, or validation differ.
- Prefer owner-layer fixes over local guards, cosmetic rewrites, broad catch blocks, or hidden fallbacks.
- Do not report generic best practices, hypothetical scale concerns, or style preferences without repo-visible reachability.

## Work item quality

- Every finding must include affected surface, actors/consumers/states, expected behavior, acceptance criteria, and validation direction when discoverable.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- If validation commands or harnesses are absent, specify observable checks that an execute run can add or perform.
