---
name: pixverse-audio
description: "Music and sound: create music or sound assets, or route audio work to narration and mixing. Use voiceover for a spoken delivery and captions for subtitles."
---

# Voice and Music

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

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

Read `../../skills-shared/audio-craft.md`.

For standalone SFX/reference-audio capabilities, read
`../../skills-shared/extended-capabilities.md`. Native UGC voices follow their
specialized workflow; do not simplify its audio map into a sparse generic prompt.

## Voice

Use standalone voice when narration needs timing, reuse, subtitles, or download:

```bash
pixverse voice presets --model speech-2.8-hd --language zh --json
pixverse create voice --model speech-2.8-hd --voice-id <preset_voice_id> --text "..." --json
```

Use `pixverse voice models` and `pixverse voice presets --model <id>` when the user wants voice choice.

For natural or timed narration, use `../pixverse-voiceover/SKILL.md`. Generate natural speech sections, measure their audio and align captions afterward through `../pixverse-captions/SKILL.md`. Keep the final SRT under `projects/<slug>/prompts/` or `projects/<slug>/assets/subtitles/`. The following segmented queue is only for an explicit fixed-window take list:

```bash
"${PVX}" subtitles clean <srt> <clean.srt>
"${PVX}" subtitles inspect <clean.srt>
"${PVX}" subtitles style --format force-style
"${PVX}" subtitles voice-queue <clean.srt> projects/<slug>/voice-queue.json --project <slug> --segments-dir projects/<slug>/prompts/tts-segments --voice-id <preset_voice_id> --language zh
```

Existing continuous audio can receive accurately aligned captions without another generation. Preserve accepted spoken words; clean display punctuation only when that style is wanted. Start from the plugin subtitle style and verify readability in the actual frame.

## Music

Use standalone music when BGM/soundtrack is requested:

```bash
pixverse music models --json
pixverse create music --model music-2.6 --prompt "..." --instrumental --json
```

Use lyrics only when vocals are part of the concept. `music-3.0` (MiniMax Music 3.0)
and `music-v2` (ElevenLabs Music V2) support lyrics, auto lyrics and instrumental
generation; the default remains `music-2.6`. Read
`../../skills-shared/pixverse-cli-1.4.4.md` for the reviewed alternatives.

Music is generated at auto-duration and edited to the picture; `--duration-seconds` and
`--no-duration-auto` are refused by the queue because the service rejects fixed targets.
Treat a requested length as an edit requirement: measure the returned audio and trim/fade
locally. See the shared audio craft reference.

## Video Audio

Use in-video generated sound when the brief wants the model to synchronize ambience and sound effects to the generated motion. Do not describe this as "music none" shorthand; write the no-music requirement in plain natural language.

Before using `--audio`, decide and record one of these modes:

These switches apply only when the selected model exposes them. Seedance 2.5 omits both
`--audio` and `--no-audio`; keep sound intent in the prompt, inspect returned sound, and mute
locally for a silent deliverable. Missing toggle support does not establish missing audio.

MiniMax H3/H3 Max is a different contract: generated audio is unsupported. Its
`--audios` accepts reference inputs; it does not enable output sound. Plan separate
voice/music or local sound assets when sound is required, preserving paid approval.

| Mode | Use when | Command stance |
|---|---|---|
| synced SFX/ambience | model should create sound tied to visible motion, with no music | `--audio`; use natural-language no-music instruction |
| clean picture | sound will be rebuilt from separate stems or user asked for silent picture | `--no-audio` |
| fused native audio | casual social/UGC clip where baked audio including music may be acceptable | `--audio` where supported; preserve the workflow’s complete sound/voice plan |

For in-video generated sound, use a plain-language audio paragraph and avoid musical cue words:

```text
This video should not generate any music, background music, score, melody, rhythmic bed, or trailer-style musical hit.
Only generate synchronized sound effects and environmental ambience for what is visible in the shot.
The sound should be natural and quiet: physical Foley from the characters and objects, room tone, air, footsteps, fabric, breath, water, and other diegetic sounds.
Do not add orchestral emotion, musical chimes, melodic pads, percussion, or any soundtrack-like layer.
```

If the result contains unwanted music or unpleasant SFX/ambience, mark that audio rejected and strip/replace it. Do not mix BGM over a bad generated track.

If `quote queue` adds an audio note, treat it as an advisory reminder. If the prompt already says "no music" or the user's intent is clear, proceed to confirmation without changing the route. Only rewrite the sound paragraph when it is quick and obviously improves the prompt; do not switch to `--no-audio` or delay the run just to silence the note.

For post overlay, use `../pixverse-video-editing/SKILL.md` and keep audio assets separate.
