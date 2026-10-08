---
name: pixverse-short-drama
description: "Short drama: develop scripted scenes with recurring characters, dialogue coverage, continuity and separately scoped generation batches."
---

# Short Drama

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

Vertical drama is about emotional compression and a clear next-episode hook.

Read:

- `../../skills-shared/prompt-craft.md`
- `../../skills-shared/audio-craft.md`
- `../../skills-shared/model-routing.md`

## Fast Path

1. Pick one conflict and one reversal.
2. Lock 1-3 characters.
3. Write a 4-beat vertical episode:
   - hook
   - confrontation
   - reveal
   - cliffhanger
4. Use 9:16, 8-15s.
5. Use dialogue only if it can be short and readable.

## Genres

- revenge reveal
- CEO romance power flip
- family betrayal
- rebirth/second chance
- hidden identity
- contract marriage
- workplace humiliation reversal

## Character Rules

If the user wants a series, use `../pixverse-character-sheet/SKILL.md` first or create character boards. Consistency beats novelty.

## CLI Shape

```bash
pixverse create video --model seedance-2.5 --quality 1080p --duration 15 --aspect-ratio 9:16 --prompt "..."
```

Use `seedance-2.5` at 1080p for both preview and final shots. Apply `../../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` before preflight; preserve the workflow-specific creative controls.

For exact spoken lines, consider standalone voice plus post-editing.

## Quality Checks

- hook visible in first 2 seconds
- characters readable on mobile
- reversal lands
- cliffhanger is visual, not just explained
- no dialogue overload
