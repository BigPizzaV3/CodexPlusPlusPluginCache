---
name: vibe-probe
description: "Run one bounded bug-finding probe in an unvisited backend, frontend, architecture or visual area. Fix one proven defect when requested, retain visible thread history, and stop after one primary area."
---

# Quick bug discovery

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

Track primary areas and outcomes from **all** visible probes in this conversation. A repeated probe chooses a new owner/boundary; rereading consumers does not make them a new primary area. Explicit user targets take precedence over novelty: revisiting a named area to finish or verify a fix is allowed. Never claim memory of unseen tasks.

Use architecture for dependency direction and ownership; backend for server runtime; frontend for client state/data flow; visual for presentation and accessibility. Do not hide a state bug with CSS. Generic bug probe is the fallback when no specific surface is selected.

After the chosen area is fixed, clean, blocked or unavailable, report that area, owner, evidence and status. “Clean” applies only to that area. If context has been lost, state the coverage limit instead of inventing a visited ledger.

## Recipes

| Recipe | Operation |
|---|---|
| [Instant Architecture Probe](references/instant-architecture-probe.md) | probe |
| [Instant Backend Probe](references/instant-backend-probe.md) | probe |
| [Instant Bug Fix Polish](references/instant-bug-fix-polish.md) | probe |
| [Instant Frontend Probe](references/instant-frontend-probe.md) | probe |
| [Instant UI-UX Visual Probe](references/instant-ui-ux-visual-probe.md) | probe |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
