# Map Staleness Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Determine whether repository maps are stale after a patch, branch delta, migration, documentation sync, or requested scope change. Return the smallest required map-refresh contour without changing product code, tests, configs, generated artifacts, docs, or map files.

## Patch or scope input

Use an explicit diff, PR/commit range, changed-file list, or user-supplied scope. If no target is visible, inspect the current working tree. If there is no changed surface or requested map boundary, return a blocked/no-op verdict.

## Map family contour

Map changed files to map families:

- Product/docs/requirements/capabilities/journeys/analytics/copy → [Product Requirements Map](../../vibe-map/references/product-requirements-map.md), [Product Capability Map](../../vibe-map/references/product-capability-map.md), [Product Journey Map](../../vibe-map/references/product-journey-map.md), [Product Metrics Events Map](../../vibe-map/references/product-metrics-events-map.md), [Traceability Map](../../vibe-map/references/traceability-map.md), [Risk & Release Map](../../vibe-map/references/risk-release-map.md).
- Web/SaaS routes/layouts/forms/tables/navigation/UI states → [SaaS Navigation Map](../../vibe-map/references/saas-navigation-map.md), [Product Journey Map](../../vibe-map/references/product-journey-map.md), [Auth Entitlements Map](../../vibe-map/references/auth-entitlements-map.md), [Test Coverage Map](../../vibe-map/references/test-coverage-map.md).
- Bot commands/handlers/FSM states/keyboards/deep links/proactive messages → [Bot Navigation Map](../../vibe-map/references/bot-navigation-map.md), [Runtime Flow Map](../../vibe-map/references/runtime-flow-map.md), [Auth Entitlements Map](../../vibe-map/references/auth-entitlements-map.md), [Test Coverage Map](../../vibe-map/references/test-coverage-map.md).
- Routes/API/schemas/webhooks/generated clients → [API Navigation Map](../../vibe-map/references/api-navigation-map.md), [Integration Map](../../vibe-map/references/integration-map.md), [Traceability Map](../../vibe-map/references/traceability-map.md), [Test Coverage Map](../../vibe-map/references/test-coverage-map.md).
- AI prompts/model calls/tool schemas/RAG/OCR/ML/evals/provider config → [AI Navigation Map](../../vibe-map/references/ai-navigation-map.md), [Integration Map](../../vibe-map/references/integration-map.md), [Runtime Flow Map](../../vibe-map/references/runtime-flow-map.md), [Test Coverage Map](../../vibe-map/references/test-coverage-map.md).
- Entities/migrations/ORM/indexes/retention/PII → [Domain Data Map](../../vibe-map/references/domain-data-map.md), [Ownership & Invariant Map](../../vibe-map/references/ownership-invariant-map.md), [Test Coverage Map](../../vibe-map/references/test-coverage-map.md).
- Auth/RBAC/ABAC/tenancy/plans/quotas/feature gates → [Auth Entitlements Map](../../vibe-map/references/auth-entitlements-map.md), [RBAC ABAC Policy Map](../../vibe-map/references/rbac-abac-policy-map.md), [Ownership & Invariant Map](../../vibe-map/references/ownership-invariant-map.md), [Traceability Map](../../vibe-map/references/traceability-map.md).
- Workers/events/queues/workflows/realtime/cache/search → [Runtime Flow Map](../../vibe-map/references/runtime-flow-map.md), relevant domain maps, [Test Coverage Map](../../vibe-map/references/test-coverage-map.md).
- External providers/SDKs/webhooks/credentials/rate limits → [Integration Map](../../vibe-map/references/integration-map.md), [Runtime Flow Map](../../vibe-map/references/runtime-flow-map.md), [Risk & Release Map](../../vibe-map/references/risk-release-map.md).
- Config/deploy/flags/migrations/runbooks → [Risk & Release Map](../../vibe-map/references/risk-release-map.md) and relevant runtime/integration maps.

## Check rules

- Do not force maps into repositories that do not use them.
- Do not edit files. This prompt is verification-only.
- Treat maps as evidence indexes, not authority. A stale map is a follow-up gate, not proof of implementation correctness.
- Verify risky or contradictory map claims against current owner evidence before declaring a map clean.
- Preserve role boundaries: do not perform a new domain audit, do not generate implementation tasks, and do not review the whole repository outside the changed contour.
- When map staleness is clear, name the exact map-skill or [Map Refresh Polish](map-refresh-polish.md) path that should update it.
- If current evidence is insufficient, return `blocked` with the missing evidence or required owner decision.
