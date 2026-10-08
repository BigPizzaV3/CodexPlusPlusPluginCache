---
name: pixverse-music-video
description: "Music video (MV): plan and assemble performance, mood or narrative shots around supplied or requested music, with deliberate rhythm and visual continuity."
---

# Music Videos

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

The music owns the edit. Visuals should have a repeatable grammar, not random pretty shots.

Read:

- `../../skills-shared/audio-craft.md`
- `../../skills-shared/cinematography.md`
- `../../skills-shared/exploration-patterns.md`
- `../../skills-shared/model-routing.md`

## Fast Path

1. Identify track mood, tempo, lyric theme, and format.
2. Choose MV mode.
3. Generate a visual board.
4. Render a 8-15s loop or teaser.
5. If music is needed, generate it as a separate asset.

## MV Modes

- **Performance:** singer/band/dancer as anchor.
- **Lyric world:** visual metaphors follow the lyrics.
- **Dance:** choreography and body motion lead.
- **Visual album:** abstract mood, texture, symbols.
- **Narrative fragment:** one emotional beat, not a full plot.
- **Loop:** seamless social visualizer.

## Prompt Anchors

Include:

- tempo feel
- color system
- performance or no-performance rule
- camera rhythm
- recurring motif
- audio relationship

## CLI Shape

Music:

```bash
pixverse create music --model music-2.6 --prompt "..." --instrumental --json
```

Default to auto-duration music. Cut, loop, fade and duck locally to the edit length.
For an explicitly requested generation target or another music model, follow the
current model contract in `../../skills-shared/audio-craft.md`; measure the returned
track before setting the picture timing.

Video:

```bash
pixverse create video --model seedance-2.5 --quality 1080p --duration 15 --aspect-ratio 9:16 --prompt "..."
```

Use `seedance-2.5` at 1080p for both preview and final shots. Apply `../../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` before preflight; preserve the workflow-specific creative controls.

## Make It Yours

Pick one visual law and hold it:

- all scenes seen through reflections
- singer never appears directly
- every cut follows a color change
- motion always moves toward camera
- lyrics become physical objects

## Quality Checks

- first frame matches track promise
- motion has rhythm
- visual motif repeats
- no random montage drift
- audio asset and video concept can actually be combined
