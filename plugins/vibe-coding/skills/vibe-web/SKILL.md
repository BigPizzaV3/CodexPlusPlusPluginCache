---
name: vibe-web
description: "Audit, fix or verify web server/client boundaries: SSR, hydration, serialized data, route caches, server actions and navigation in an existing framework. Use for rendering/runtime defects; product UX and visual design have separate skills."
---

# Web rendering & server boundaries

Read [the shared workflow](../../references/workflow.md) once, then the recipe matching the requested operation. Identify the installed framework/router and rendering mode; do not assume React or Next.js solely because a task concerns a web app.

| Request | Recipe |
|---|---|
| Inspect rendering, serialization or navigation | [Web Rendering Audit](references/web-rendering-audit.md) |
| Fix the named rendering or server boundary | [Web Rendering Polish](references/web-rendering-polish.md) |
| Verify initial render, private data or a server mutation | [Web Server/Client Boundary Check](references/web-boundary-check.md) |

Use the shared [rendering boundaries](../../references/web-rendering.md) for the selected framework path. UI acceptance belongs to [Product](../vibe-product/SKILL.md); an explicit patch review belongs to [Review](../vibe-review/SKILL.md). Follow necessary contract edges without turning the task into a framework migration or redesign.

Invocation lifetime and provider execution limits belong to [Serverless](../vibe-serverless/SKILL.md); optimistic client reconciliation belongs to [Realtime](../vibe-realtime/SKILL.md). Use [Cache](../vibe-cache/SKILL.md) for shared invalidation independent of rendering.
