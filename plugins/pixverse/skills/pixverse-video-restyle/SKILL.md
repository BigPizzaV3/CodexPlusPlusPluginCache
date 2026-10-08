---
name: pixverse-video-restyle
description: "Video restyle: change the look, world, wardrobe, subject or medium of an existing video while keeping its motion, performance, timing and cuts, through Seedance edit and reference routes plus local grading."
---

# Video Restyle

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

Keep what moves; change how it looks. A restyle preserves the source's duration, motion,
performance, camera and cuts while replacing its style, setting, wardrobe, medium or the
subject's appearance. It is not a remake and not a new clip that merely resembles the source.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Decide What Survives

Inspect the source once with `"${PVX}" media probe` and a contact sheet (`media tile
--every 1`). Record duration, aspect, cut times, visible text, speech and which elements are
protected. Write a change sheet: one target change per output, protected elements, and the
acceptance checks. Distinguish:

- **Local grade, crop, retime, overlay**: `../pixverse-video-editing/SKILL.md`, no generation.
- **Look/world/wardrobe/medium change with the same motion**: the generative routes below.
- **Different person doing the same performance**: identity replacement, also below, with a
  supplied or accepted reference person.
- **Motion transferred onto a new character**: `create motion-control` (character image plus
  motion video); it does not preserve the source scene, voice or edit.

Explain which route is possible before spending; a candidate route is not proof of exact
preservation. Read `./references/routes.md` for the current capability walls.

## Generate

Compose the queue through the gateway. The primary route is Seedance 2.5
`create reference --task-type edit` with the source in `--videos`, `--duration auto`,
`--aspect-ratio auto`, `--quality 1080p`, plus identity/style references in `--images`.
Write the prompt as a preservation contract: what the model must keep (every movement,
gesture, cut, framing, timing, untargeted text), then the one change, then the render style
(`../../skills-shared/prompt-kits.md` for wording). Each output binds the original source,
never a previous variant. For long sources split by scene with `media cut` and rejoin.

The CLI has no Seedance audio toggle. Plan to restore the original audio at export when
speech or music must survive; changed lip motion can invalidate reuse of original speech.

## Compare And Deliver

Compare source and result on the same contact-sheet grid (`media tile --every 0.5` over the
difficult motions, cut boundaries and text moments). Check full duration, motion fidelity,
identity or style consistency across cuts, and that untargeted text survived. Restore the
soundtrack with FFmpeg when authorized. Report any preservation failure honestly instead of
calling a similar-looking clip a restyle. Repair only the rejected version; accepted outputs
stay. For a batch of looks over one source, use `../pixverse-video-variants/SKILL.md`.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
