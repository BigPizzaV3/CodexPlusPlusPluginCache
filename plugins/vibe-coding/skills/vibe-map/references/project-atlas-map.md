# Project Atlas Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/project_atlas_map.md` as the top-level repository navigation artifact. It should let a new audit or implementation run understand the product, major domains, runtime surfaces, source-of-truth owners, and which detailed maps to consult next.

## Inspect

Read entry docs, package/workspace manifests, application roots, routing, API handlers, workers/jobs, storage schemas, infrastructure/config, integration clients, auth and billing seams, test entry points, generated artifacts, and existing maps. Prefer current repository files over stale prose.

## Map content

### Evidence and IDs

- Write or update `docs/project_atlas_map.md` when the environment allows it. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs when refreshing: capability `CAP-*`, bounded context `CTX-*`, surface `SURF-*`, runtime flow `FLOW-*`, integration `INT-*`, risk or unknown `RISK-*`.
- Anchor entries to current evidence as `path:line[-line]` plus symbol when possible.
- Treat generated maps as discovery aids, not authority. Verify risky or stale claims against code, schemas, config, tests, canonical specs, or runtime evidence.
- Mark unknowns only when they affect future audit, decomposition, implementation, validation, rollout, or ownership.

### Coverage

Cover product type and users, core capabilities, bounded contexts, UI/API/bot/AI/mobile surfaces, storage and state owners, jobs/workflows, external integrations, auth/entitlements, observability/ops surfaces, test strategy, release gates, and links to detailed maps.

### Entry details

For each capability or context, capture owner files/symbols, primary actors, input/output contracts, main data entities, direct producers/consumers, related tests/docs, and the next best prompt-skills for deeper audit or polish. Avoid speculative architecture narratives.

## Markdown structure

Use a concise hierarchy: summary, conventions, capability index, bounded contexts, surface map, storage/state owners, runtime/integration index, auth/entitlement index, validation/release index, detailed map links, unknowns, assumptions. Omit sections absent from the repo.
