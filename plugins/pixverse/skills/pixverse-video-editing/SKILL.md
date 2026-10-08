---
name: pixverse-video-editing
description: "Video editing: edit existing footage from any source; trim, reorder, reframe, retime and mix sound into a finished video. Local edits need no PixVerse login."
---

# Video Editing

Edit the supplied footage directly, including clips made outside PixVerse. Keep source files
intact and write a new master under `projects/<slug>/deliverables/`. A request to cut, reframe
or mix existing media needs no PixVerse login, model lookup, generation queue or paid preflight.
Use FFmpeg/ffprobe for local edits and preserve the supplied source media.

For layered layouts, animated overlays or revision of an existing FFmpeg edit, read
`./references/composition-contract.md`. It preserves source intervals, timing, audio
ownership and reproducible render files. Keep unrelated existing edits intact.

## Fast Path For Existing Footage

Work from usable footage already supplied or obtained by Codex. If the user supplies a
webpage link, Codex chooses how to acquire the material with its available tools before
editing here. Reuse any reference notes that are already available.

1. Inspect available files and needed stream metadata in one local call. Reuse known duration,
   dimensions and sound decisions. View/listen only where the requested edit needs judgment.
2. Translate the brief into source intervals, order, output aspect and sound treatment. For a
   simple trim, the request itself is the edit plan. For several shots, save a compact cut list
   with source path, in/out seconds, output position, overlays and audio treatment.
3. Render with FFmpeg. Use `./references/local-editing.md` for accurate trims,
   mixed-format assembly, reframing and speed changes. Batch compatible operations into one
   render rather than repeatedly encoding a clip.
4. Return the actual output file and the cut list or render source. Verify the requested change:
   for example, duration for a trim or subject framing for a vertical crop. Add other checks
   only when the edit requires them or the user requests review.

For reference-based editing, reuse timecoded notes already supplied by the user or Codex;
there is no prerequisite PixVerse analysis workflow. For captions use `../pixverse-captions/SKILL.md`; for exact animated layers use
`../pixverse-motion-design/SKILL.md`; for inserts, boards, stickers and sounds that must land on
spoken words, use `../../skills-shared/anchored-composition.md` (`"${PVX}" timeline render`). Read `../../skills-shared/audio-craft.md` for a sound rebuild,
not for every trim. Only missing generated media enters the CLI contract below.

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

When the edit requires new generated media, read `../../skills-shared/cli-workflow.md` before
that generation. It contains the existing account-aware routing, paid-work
confirmation, progress, preview and project-handoff rules. Studio and Production are
not prerequisites. The shared account, confirmation and direct-medium rules govern the
examples and defaults below. Read the gateway only when writing manual CLI commands or queue specs.
Creation command examples below are queue-task fragments, not permission to submit paid
`pixverse create` commands directly.

## Canvas Boundary

Apply this boundary only after the current target has been resolved as Canvas under
`../../skills-internal/pixverse-agent-canvas/SKILL.md`. For that Canvas target, inspect the current Canvas capabilities and
node schemas before downloading assets or invoking FFmpeg, then use Canvas-native editing nodes and
existing graph connections whenever they can express the requested composition.

For every non-Canvas project—including ordinary PixVerse queues, standalone local assets, and local
deliverables—do not run Canvas discovery or change the established local editing route. The recipes
below remain the default and behave as before. They also remain available as an explicit Canvas
fallback; they do not override the Canvas-native-first rule once Canvas is the selected target.

Do not download, locally edit, and re-upload media that already exists in Canvas merely because a
local recipe is available. If Canvas lacks a required operation or the user explicitly requests a local
master, keep intermediates local and upload only the final result once if later Canvas work actually
needs it.

## Common Tasks

- download PixVerse assets
- stitch multiple clips
- add background music
- overlay narration
- strip rejected generated audio
- rebuild sound from separate voice, music, ambience, and SFX stems
- burn subtitles
- trim starts/ends
- create final deliverable folder
- verify the requested edit

## Subtitle And TTS Sync

For narrated videos, use actual audio as the clock and keep one canonical timed subtitle file for rendering. An SRT entry looks like:

```text
1
00:00:00,000 --> 00:00:03,200
First spoken subtitle line
```

Workflow:

- Reuse accepted audio, or produce narration in natural sections through `../pixverse-voiceover/SKILL.md`. Write `projects/<slug>/prompts/narration.srt` from verified words and actual timing through `../pixverse-captions/SKILL.md`.
- Keep entries readable in one or two lines with sensible phrase boundaries. Match the requested typography; clean display punctuation only when that style is desired, retaining the spoken source text.
- Inspect the timed captions: `"${PVX}" subtitles inspect projects/<slug>/prompts/narration.srt`.
- For an explicit fixed-window take list, `"${PVX}" subtitles voice-queue projects/<slug>/prompts/narration.srt projects/<slug>/voice-queue.json --project <slug> --segments-dir projects/<slug>/prompts/tts-segments --voice-id <voice_id> --language zh` can prepare separate takes. It is not the default for every captioned film; preserve the voice model's natural speed unless the user requests a speed change.
- Quote and confirm a new voice queue before running it. Do not create voice tasks for a caption-only change.
- Measure each returned take. Align the final subtitle windows to speech, or fit explicitly timed takes to their required windows without clipping words. One caption does not need to own one voice asset.
- Burn subtitles from the same SRT, or convert the same SRT to ASS for style. Use the plugin default subtitle style unless the user asks for a different look.
- If speech and picture lengths differ, align captions to real speech and trim only verified
  idle padding. Fixed-window narration follows its voiceover recipe; do not tempo-shift or
  cut words merely to pass its timing gate. Explicit user-requested retiming remains available.

Example burn-in:

This example explicitly replaces the soundtrack with accepted narration. For a caption-only
change, preserve the existing audio and use the captions workflow instead.

```bash
"${PVX}" subtitles style
"${PVX}" subtitles style --format force-style
ffmpeg -nostdin -n -i video.mp4 -i voice.mp3 -vf "subtitles=projects/<slug>/prompts/narration.srt:force_style='<force_style_from_pvx>'" -map 0:v -map 1:a -c:v libx264 -c:a aac out.mp4
```

Default burn-in style for 1080p horizontal delivery is intentionally restrained: `Fontsize=18`, `MarginV=28`, bottom-centered, white text, small dark outline. Do not improvise oversized subtitle text such as `Fontsize=34` or larger for normal subtitles; reserve larger type for title cards or intentional on-screen typography.

## Download

```bash
"${PVX}" pixverse asset download <id> --type video --dest ./projects/<slug>/assets/videos
"${PVX}" pixverse asset download <id> --type audio --dest ./projects/<slug>/assets/audio
```

## Stitch With FFmpeg

For an ordered non-Canvas PixVerse story run, prefer the integrated local path:

```bash
"${PVX}" story assemble <slug> --output projects/<slug>/deliverables/final-story.mp4 --sample-frames
```

It resolves `shot-*` assets from the latest billing ledger, downloads missing clips, re-encodes a compatible H.264/AAC timeline, runs duration QA, samples the full timeline, and records the result. Use the manual FFmpeg forms below for custom clip order, mixed formats, transitions, or sound rebuilds.

For streams with matching codec, dimensions, frame rate, time base and audio layout,
create a concat list (escape quote characters in actual paths):

```text
file 'clip1.mp4'
file 'clip2.mp4'
```

Then:

```bash
ffmpeg -nostdin -n -f concat -safe 0 -i list.txt -c copy ./projects/<slug>/deliverables/final.mp4
```

If streams differ, normalize each clip before concatenating; see
`./references/local-editing.md`. Merely changing the output codec after a concat demuxer
does not normalize incompatible source dimensions or stream layouts.

## Add BGM

Keep music lower than dialogue. For a clip with an existing audio stream, this simple
overlay keeps that soundtrack and limits the mix to its duration:

```bash
ffmpeg -nostdin -n -i video.mp4 -i music.mp3 -filter_complex "[1:a]volume=0.18[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[a]" -map 0:v -map "[a]" -c:v copy -c:a aac out.mp4
```

When the source has no audio, map the music directly and bound it to the video duration.
Choose trim, fade, silence or a loop deliberately when the music is shorter; do not reference
a nonexistent `[0:a]` or let `-shortest` accidentally cut the picture.

## Rebuild Rejected Audio

If generated video audio contains unwanted music, bad ambience, or unusable SFX, strip it first:

```bash
ffmpeg -nostdin -n -i video.mp4 -map 0:v -c:v copy -an picture-clean.mp4
```

For serious sound work, prepare `development/sound-cue-sheet.md` before mixing:

| Time | Visual beat | Stem | Source file | Mix note |
|---|---|---|---|---|
| 00:00-00:02 | door opens | hinge creak | assets/sfx/hinge.wav | quiet, left |
| 00:02-00:06 | town exterior | ambience | assets/sfx/night-town.wav | low bed |

Do not bury a rejected generated audio track under BGM. Replace it with controlled stems or deliver a clean temp mix and state which stems are still missing.

## Targeted Verification

Inspect the requested edit, not a compulsory full production checklist. Duration, dimensions
and audio-stream presence can be checked with ffprobe; cut continuity, legibility and audible
mixing require viewing or listening when those operations were requested. For explicit QA or
a named specialized check, read `../../skills-internal/pixverse-agent-quality/SKILL.md` and use:

```bash
"${PVX}" qa inspect ./projects/<slug>/deliverables/final.mp4 --project <slug> --sample-frames
```

## Checks By Edit Type

- Cut/assembly: requested intervals and order, expected duration, no unintended black gaps.
- Reframing: requested dimensions, correct pixel aspect, important subjects still visible.
- Sound: retained/replaced/removed as requested; listen if mixing or synchronization changed.
- Captions: measured speech timing, readable type, safe placement and requested typography.
- Handoff: actual master path; include editable sources when requested and record multi-stage
  project decisions for continuation. Name the FFmpeg source list, timing data and filter graph.
