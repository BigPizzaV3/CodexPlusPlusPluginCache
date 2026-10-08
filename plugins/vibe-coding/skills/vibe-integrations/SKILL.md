---
name: vibe-integrations
description: "Audit, fix or verify outbound clients, deadlines, retries, trusted proxies, TLS, webhooks and server WebSocket/SSE lifecycle under bounded failure scenarios."
---

# Integrations & networking

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Backend Integrations Audit](references/backend-integrations-audit.md) | audit |
| [Backend Integrations Polish](references/backend-integrations-polish.md) | implement |
| [Network Integration Failure Check](references/network-integration-failure-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
