---
name: vibe-harness
description: "Audit, fix or verify agent harness state machines, checkpoint/resume, bounded fan-out, cancellation, durable side effects and replay. This concerns application orchestration code, not creating assistant tasks."
---

# Agent execution

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Agent Harness Audit](references/agent-harness-audit.md) | audit |
| [Agent Harness Polish](references/agent-harness-polish.md) | implement |
| [Agent Harness Replay & Failure Check](references/agent-harness-replay-failure-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Model selection, grounding and tool-choice quality belong to [AI](../vibe-ai/SKILL.md); wire protocol/tool discovery belongs to [MCP](../vibe-mcp/SKILL.md). This skill owns durable run state and side-effect recovery.
