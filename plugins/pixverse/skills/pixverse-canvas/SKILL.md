---
name: pixverse-canvas
description: "PixVerse Canvas: create, open, continue or edit a visual project with connected image/video nodes, references and native composition. Use for an explicitly selected Canvas workflow."
---

# PixVerse Canvas

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Use this public entry to go directly into the Canvas workflow. Studio is not a prerequisite.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `SKILL.md` path: it is two
directories above this skill directory and contains `.codex-plugin/plugin.json`. In each new shell
session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helpers through `"${PVX}"`, preserving the user's working directory. Do not assume the current
directory is the plugin checkout or bypass the installed wrapper with a module invocation.

## Direct Canvas Route

1. Confirm that Canvas is the intended work target from the user's request or selected-project
   continuation. An ambient browser tab or an old `.canvas-project.json` alone does not select this
   route. An explicit non-Canvas request keeps its ordinary workflow.
2. Read `../../skills-internal/pixverse-agent-canvas/SKILL.md` immediately. It is the single canonical
   operating contract; follow it for binding, early browser handoff, graph operations, paid-work
   authorization, cloud preview, recovery, and delivery. This entry does not define a second workflow.
3. Before the first browser action, read `../../skills-shared/web-handoff.md`. Use the host's current
   top-level Computer Use/CUA entrypoint when exposed, follow the documentation returned by its first
   call, and apply the Codex IAB-only handoff and unavailable-browser fallback. With a resolved project,
   make the early browser handoff the first visible milestone, not a final delivery step.

Do not load Studio, Production, Delivery, or the full internal root merely to reach Canvas. Load other
playbooks only for a concrete need identified by the canonical Canvas contract. If that contract is
already loaded in this turn, continue from it without repeating initialization or browser handoff.

The canonical **Cloud Preview And On-Demand Delivery** rules override ordinary queue/local defaults
only for this selected Canvas target. Opening or inspecting a project is not permission to mutate or
generate; creating media still follows the canonical preflight and effective confirmation policy.
