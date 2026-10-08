---
name: vibe-celery
description: "Audit, fix or verify Celery task publication, acknowledgements, retries, time limits, prefetch, schedules and warm/cold shutdown against the actual broker and pool."
---

# Celery

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Celery Delivery & Shutdown Check](references/celery-delivery-shutdown-check.md) | check |
| [Celery Workers Audit](references/celery-workers-audit.md) | audit |
| [Celery Workers Polish](references/celery-workers-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
