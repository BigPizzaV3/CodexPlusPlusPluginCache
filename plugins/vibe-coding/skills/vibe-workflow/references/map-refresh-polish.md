# Map Refresh Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Refresh stale repository map documents after [Map Staleness Check](map-staleness-check.md), a patch, branch delta, migration, documentation sync, or an explicit map-refresh request. Keep the update limited to the affected map artifacts and preserve the map-as-evidence-index contract.

## Inputs

Use the stale-map verdict, explicit diff, PR/commit range, changed-file list, user-supplied scope, or current working-tree evidence. Common map artifacts include `docs/project_atlas_map.md`, `docs/product_requirements_map.md`, `docs/product_capability_map.md`, `docs/product_journey_map.md`, `docs/product_metrics_events_map.md`, `docs/saas_navigation_map.md`, `docs/bot_navigation_map.md`, `docs/api_map.md`, `docs/ai_map.md`, `docs/owner_invariant_map.md`, `docs/domain_data_map.md`, `docs/runtime_flow_map.md`, `docs/integration_map.md`, `docs/auth_entitlements_map.md`, `docs/rbac_abac_policy_map.md`, `docs/traceability_map.md`, `docs/test_map.md`, and `docs/risk_release_map.md`.

## Refresh contour

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

## Refresh rules

- Do not force maps into repositories that do not use them.
- Do not update product code, tests, configs, generated artifacts, or implementation docs outside map artifacts.
- Refresh the smallest safe subset of maps that are directly affected by the selected contour.
- Preserve stable IDs, existing structure, and provenance where possible.
- Verify every refreshed claim against current owner evidence. Remove or mark stale entries rather than preserving false links.
- When a map conflicts with code, schemas, config, tests, canonical docs, or runtime evidence, the owner source wins.
- If a map needs domain judgment not present in the repo, leave a clear unknown instead of inventing behavior.
- If multiple maps need large rewrites, update the smallest coherent subset and list remaining map refreshes as blocked follow-up.
