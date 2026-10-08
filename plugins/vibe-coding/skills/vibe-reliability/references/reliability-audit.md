# Reliability Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Find reachable reliability risks where production behavior can fail, degrade, retry incorrectly, or become undiagnosable under realistic dependency, network, process, deploy, or data-shape failures.

## Inspect

Request handlers, service boundaries, workers, schedulers, queues, webhooks, external provider clients, database transactions, migrations, storage, cache, config/env loading, health/readiness checks, logs/metrics, tests, CI, deploy docs, and runbooks.

## Focus areas

- Timeouts and cancellation: unbounded waits, missing request/job deadlines, leaked work after caller aborts, or mismatched provider timeouts.
- Retries and backoff: retry storms, retrying non-idempotent operations, missing jitter, hidden infinite loops, duplicate side effects, or provider rate-limit amplification.
- Degraded modes: dependency failure paths that crash critical surfaces, serve unsafe stale data, mask partial failure, or lose operator context.
- Startup/deploy: boot order assumptions, missing migrations/config validation, readiness checks that pass before dependencies are usable, unsafe shutdown/drain behavior.
- Data durability: acknowledged work before durable write, partial writes without recovery, lost events, skipped dead-letter/error states, or non-replayable jobs.
- Diagnostics: errors that are swallowed, logged without correlation, exposed to users, or impossible to trace from a symptom to the owner layer.

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
