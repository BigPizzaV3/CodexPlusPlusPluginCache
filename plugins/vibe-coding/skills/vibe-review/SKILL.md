---
name: vibe-review
description: "Review an explicit patch, PR, branch or working-tree delta and its direct contract dependencies. Default to findings only; fix review defects when requested. Use for patch review, not whole-repository audits."
---

# Change review

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Patch Checking](references/patch-checking.md) | review |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
