# Product Capability Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/product_capability_map.md` as an evidence-backed map of product capabilities, user value, actors, entry points, acceptance boundaries, and implementation owners.

## Inspect

Product routes, navigation, feature modules, copy, onboarding, settings, billing/plan gates, permissions, analytics events, experiments, docs/PRDs, tests, API contracts, workers, and existing product maps. Use repository behavior as the primary evidence source.

## Map rules

- Write or update `docs/product_capability_map.md` when possible; otherwise print the full markdown.
- Preserve stable IDs: capability `CAP-*`, actor `ACT-*`, journey `JNY-*`, requirement `REQ-*`, acceptance `ACC-*`, metric `MET-*`, risk `RISK-*`.
- Connect each capability to an authoritative owner, visible surfaces, backend/data contracts, roles/plans/tenant scopes, tests, metrics, and known gaps.
- Separate repository facts from inferred product intent. If product docs and implementation disagree, mark drift and cite both sources.
- Do not create implementation tasks; this map feeds product audits, workstream decomposition, traceability, and release readiness.

## Coverage

Map capabilities by user/business goal, not by folder alone. Include target actors, activation path, core and edge states, monetization or entitlement dependency, analytics/events, experiments, copy/legal claims, support/admin surfaces, acceptance evidence, and explicit non-goals if they are discoverable.

## Markdown structure

Use summary, conventions, actors, capability inventory, capability detail sections, requirement/acceptance matrix, surfaced gaps/drift, product metrics links, related maps, and unknowns.
