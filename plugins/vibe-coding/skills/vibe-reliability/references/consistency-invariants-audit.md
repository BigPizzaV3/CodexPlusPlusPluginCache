# Consistency Invariants Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Find reachable consistency defects where one business rule, state transition, permission, quota, schema, cache, generated type, or external contract can drift across layers or over time.

## Inspect

Domain models, validators, permissions, plan/quota rules, API schemas, database constraints, migrations, generated clients/types, UI state gates, caches, background jobs, integrations, tests, fixtures, docs, and analytics/event contracts.

## Focus areas

- Duplicate sources of truth for rules, states, enums, permissions, quotas, feature flags, copy, cache keys, external payloads, or validation.
- State-machine gaps: invalid transitions, impossible states representable in storage/types/UI, missing terminal states, or ambiguous rollback/compensation behavior.
- Read/write drift: UI accepts states the API rejects, API accepts states storage cannot enforce, generated clients differ from handlers, or docs disagree with runtime contracts.
- Cache/search/index drift: invalidation gaps, stale denormalized fields, async projection races, missing repair/rebuild path, or inconsistent pagination/sorting semantics.
- Tenant/workspace/project isolation drift between route params, auth context, filters, policies, analytics, and background jobs.
- Test/doc drift where guard tests, fixtures, examples, or README instructions encode a contract different from the implementation owner.

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
