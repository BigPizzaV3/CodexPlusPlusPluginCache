---
name: vibe
description: "Use Vibe Coding when the user explicitly invokes the plugin without choosing a specialized skill, asks what it can do, or requests help choosing a workflow. Route by requested outcome and domain; do not trigger for every coding task."
---

# Vibe Coding

Choose the smallest suitable workflow from the user's requested outcome. Use [the shared workflow](../../references/workflow.md) once, then read the selected skill and recipe. Normal implementation should go directly to its target; do not force a preliminary map, audit or plan.

| Request | Start here |
|---|---|
| Explain or map the repository | [Map](../vibe-map/SKILL.md) |
| Shape a task, combine findings, plan several slices | [Task](../vibe-task/SKILL.md) |
| Review a patch or fix review defects | [Review](../vibe-review/SKILL.md) |
| Find and fix one new bug | [Probe](../vibe-probe/SKILL.md) |
| Check tests or release readiness | [Quality](../vibe-quality/SKILL.md) |
| MCP protocol, tool contracts or transport authorization | [MCP](../vibe-mcp/SKILL.md) |
| SSR, hydration, serialized data or server actions | [Web rendering](../vibe-web/SKILL.md) |
| Serverless invocation lifetime, duplicate triggers or edge limits | [Serverless](../vibe-serverless/SKILL.md) |
| Named domain, framework or infrastructure | [Domain catalog](../../references/catalog.md) |
| Check stale maps or maintain this package | [Workflow](../vibe-workflow/SKILL.md) |

Infer audit/implementation/check from the user's verbs and available context. Ask only for missing information that changes the result. If asked to audit and fix, continue to the authorized correction and verification. An audit-only request ends with findings. Do not spawn tasks, delegate or promise background work simply because a recipe mentions orchestration.

The optional [cycles](../../references/cycles.md) explain handoffs for genuinely multi-stage work. They are not a required ritual for every task.
