---
name: vibe-flags
description: "Audit, fix or verify feature flag defaults, targeting, backend/UI enforcement, exposure events, kill switches and removal ownership."
---

# Feature flags & rollouts

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Feature Flag Exposure & Rollback Check](references/feature-flag-exposure-rollback-check.md) | check |
| [Feature Flags Rollout Audit](references/feature-flags-rollout-audit.md) | audit |
| [Feature Flags Rollout Polish](references/feature-flags-rollout-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
