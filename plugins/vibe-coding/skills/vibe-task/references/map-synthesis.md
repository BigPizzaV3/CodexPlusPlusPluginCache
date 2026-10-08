# Map Synthesis

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Reconcile two or more repository maps into a coherent synthesis layer for navigation, stale-area detection, owner ambiguity, and next-step selection. Do not create implementation tasks in this step.

## Inputs

Use any available map artifacts, especially `docs/project_atlas_map.md`, `docs/product_requirements_map.md`, `docs/product_capability_map.md`, `docs/product_journey_map.md`, `docs/product_metrics_events_map.md`, `docs/saas_navigation_map.md`, `docs/bot_navigation_map.md`, `docs/api_map.md`, `docs/ai_map.md`, `docs/owner_invariant_map.md`, `docs/domain_data_map.md`, `docs/runtime_flow_map.md`, `docs/integration_map.md`, `docs/auth_entitlements_map.md`, `docs/rbac_abac_policy_map.md`, `docs/traceability_map.md`, `docs/test_map.md`, and `docs/risk_release_map.md`. Treat old maps, generated docs, and audit outputs as hints until verified against current owner evidence.

## Synthesis rules

- Preserve stable map IDs and provenance. Never rewrite an ID family or collapse unrelated entries just to simplify the map.
- Merge only entries that describe the same capability, owner, invariant, flow, requirement, policy, test, or release gate.
- Keep separate entries when owner, contract, rollout, validation, tenant/role/plan state, or runtime semantics differ.
- Surface conflicts when maps disagree on owner, expected behavior, enforcement point, schema, state transition, test coverage, or release gate.
- Mark stale areas when a map references missing files/symbols, outdated paths, renamed contracts, deleted tests, or docs contradicted by source evidence.
- Identify missing maps or missing cross-links only when they block useful audit, decomposition, polish, check, or release readiness.
- Recommend next prompt-skills, not implementation fixes. A map ID alone is not enough evidence for a task.
