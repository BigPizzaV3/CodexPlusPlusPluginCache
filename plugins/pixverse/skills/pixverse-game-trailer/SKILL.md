---
name: pixverse-game-trailer
description: "Game trailer: turn a game brief and available assets into a paced trailer with genre cues, gameplay presentation, title beats and sound."
---

# Game Trailers

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

A game trailer sells the promise of play. It should show verbs, not just scenery.

Read:

- `../../skills-shared/cinematography.md`
- `../../skills-shared/exploration-patterns.md`
- `../../skills-shared/model-routing.md`

## Fast Path

1. Identify game genre, player fantasy, and core verbs.
2. Choose trailer mode.
3. Generate board or key art.
4. Render 8-15s teaser.
5. QA for game readability and motion energy.

Use `seedance-2.5` at 1080p for both preview and final shots. Apply `../../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` before preflight; preserve the workflow-specific creative controls.

## Trailer Modes

- **World reveal:** environment, scale, faction identity.
- **Combat showcase:** attacks, dodge, impact, enemy response.
- **Ability reveal:** one mechanic made legible.
- **Character intro:** hero silhouette, weapon, stance, power.
- **Gameplay fake:** HUD/camera grammar suggests play.

## Prompt Anchors

Use game camera language:

- third-person over-shoulder
- isometric tactical
- side-scrolling action
- first-person inspection
- boss arena
- diegetic HUD

Do not overuse film-only terms if the result should feel playable.

## Quality Checks

- does it imply actual gameplay?
- are scale and objective readable?
- is UI present only when intended?
- does motion show a verb?
- does it avoid generic fantasy splash art?
