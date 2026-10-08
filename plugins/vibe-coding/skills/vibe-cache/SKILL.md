---
name: vibe-cache
description: "Audit, fix or verify cache keys, invalidation, TTL, stale reads and coherency across authoritative writes and readers. Focus on cache correctness rather than Redis queue semantics."
---

# Caching & freshness

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Cache Coherency Check](references/cache-coherency-check.md) | check |
| [Cache Invalidation Audit](references/cache-invalidation-audit.md) | audit |
| [Cache Invalidation Polish](references/cache-invalidation-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Client optimistic state and reconnect belong to [Realtime](../vibe-realtime/SKILL.md); server rendering and serialized responses belong to [Web](../vibe-web/SKILL.md). This skill owns shared cache identity, invalidation and freshness.
