---
name: pixverse-cinematic-story
description: "Story clip: turn a compact narrative into a few connected shots with a clear visual beat, controlled pacing and coherent sound."
---

# Cinematic Story Clips

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## CLI Execution

Apply `../../skills-shared/quality-policy.md` to all generated images/videos: Sunburst 2K/high,
Seedance 2.5 1080p with automatic prompt enhancement, and an explicit upgrade/fallback
choice for Free/Basic or model-entitlement rejection.

For an explicitly selected Canvas project or node, read
`../../skills-internal/pixverse-agent-canvas/SKILL.md` first and follow its Canvas
preflight and delivery contract; the ordinary queue/local route below does not replace it.

For ordinary creation or editing, read `../../skills-shared/cli-workflow.md` before
executing this workflow. It contains the existing account-aware routing, paid-work
confirmation, progress, preview and project-handoff rules. Studio and Production are
not prerequisites. The shared account, confirmation and direct-medium rules govern the
examples and defaults below. Read the gateway only when writing manual CLI commands or queue specs.
Creation command examples below are queue-task fragments, not permission to submit paid
`pixverse create` commands directly.

Tell one beat well. A 15-second clip cannot carry a feature plot.

Read:

- `../../skills-shared/cinematography.md`
- `../../skills-shared/prompt-craft.md`
- `../../skills-shared/model-routing.md`

## Fast Path

1. Compress the idea into one emotional turn.
2. Define character, want, obstacle, image hook, ending image.
3. For a simple one-shot story, generate video directly. Generate a board only when character/world/composition continuity makes it useful and the user approves that paid stage.
4. Render the clip.
5. QA for continuity and emotional readability.

For a multi-shot story, establish character and scene/look assets, write the detailed storyboard, and create one approved control frame per shot. Once those are approved, batch the motion stage:

```bash
"${PVX}" story queue projects/<slug>/story.json --project <slug> --shot <shot-1> --shot <shot-2> --shot <shot-3> --shot-reference <shot-1-board> --shot-reference <shot-2-board> --shot-reference <shot-3-board> --reference <character-or-world-lock> --target-duration 30 --music-prompt <instrumental-score-prompt-or-file> --audio --preflight --format markdown
```

When the story needs a reusable score, `--music-prompt` adds one independent Music 2.6 instrumental task to the same queue. It starts alongside the board and removes the extra `queue append` preparation step; trim and mix it locally after `story assemble`.

Never use one contact sheet, storyboard grid, or multi-panel sheet as the direct reference for every Seedance shot. Each shot-specific reference must be a clean cinematic frame for that shot. The compact shared `--board-prompt` route is opt-in only for low-risk stories with no visual-selection checkpoint.

After generation, use `"${PVX}" story assemble <slug> --output projects/<slug>/deliverables/final-story.mp4 --sample-frames`. This downloads missing shots, stitches, checks duration, samples across the full timeline, and writes project memory in one local call.

## Story Shapes

- **Reveal:** ordinary image becomes strange.
- **Choice:** character hesitates, acts, consequence lands.
- **Chase:** motion pressure, one clean geography.
- **Gag:** setup, escalation, reversal.
- **Trailer:** three iconic fragments, final title/feeling.
- **Fable:** symbolic character, clear moral image.

## Prompt Contract

For video, include:

- protagonist identity
- setting
- action timeline
- camera language
- emotional turn
- ending frame
- audio/dialogue only if necessary

Avoid cramming 6 scenes into one prompt. If the idea needs multiple clips, create multiple tasks and later stitch.

## Quality Checks

- can the viewer infer what changed?
- does the protagonist stay recognizable?
- does camera motion help, not confuse?
- does the ending frame feel intentional?
- is the clip too generic for the user's taste?
