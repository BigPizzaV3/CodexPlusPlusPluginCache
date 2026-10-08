---
name: pixverse-captions
description: "Video captions: create or correct timed subtitles from actual speech and render readable captions into supplied video, including translated subtitles when requested."
---

# Captions

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Make captions follow what the audience hears. Work from the actual recording, even when a draft script exists.

For a burned-in deliverable, read `./references/burn-in.md` before transcription or layout.
It defines the four ordered gates, verified-word alignment, bold/paper/clean/UGC looks,
safe geometry, glyph coverage and voice-tail checks. Sidecar and translation requests
remain separate; neither requires rendering new video unless requested.

## Establish The Words And Clock

Inspect the video duration, audio tracks, frame size, orientation and requested output. Reuse a supplied accurate timed transcript. Otherwise transcribe or align with a tool actually available in this host, then check names, numbers, language changes and uncertain words against the audio. If alignment is unavailable, offer a clearly marked timing draft or manually time a short clip; do not present guessed word timestamps as measured.

A supplied script is a candidate transcript until compared with the recording. Translation may change displayed wording, but retain the original audio time windows and meaning. Keep original and translated tracks separate when both are requested.

## Compose Readable Captions

- Split by meaning and breathing, not by fixed character counts alone. Avoid flashing one-word fragments unless requested.
- Measure text with the selected font. One or two lines may be appropriate; leave faces, product actions and platform controls visible.
- Use the plugin subtitle style as a starting point, then check the actual portrait or landscape frame. Preserve user typography and punctuation preferences.
- Export a timed SRT or ASS. Exact text is a render layer; never ask the video model to draw the captions.
- For karaoke or word emphasis, use measured word timing. Sentence timing cannot justify precise word highlights.
- For word-highlighted or word-by-word captions, write the lines as a script (`../../skills-shared/semantic-script.md`),
  align them to the recording (`../../skills-shared/word-timing.md`) and generate the ASS with
  `"${PVX}" timeline captions <timeline.json> --to captions.ass --style karaoke|bold|clean|ugc|pop`;
  role colours come from the script's speaker labels. Burn with the FFmpeg `ass` filter as usual.

## Render And Check

For ordinary local delivery, use FFmpeg and the existing subtitle helpers in `../pixverse-video-editing/SKILL.md`. Test font availability and renderer support before a full export. Inspect representative frames with short, long and mixed-language captions; watch the start and end plus several sentence transitions.

Preserve the selected soundtrack and requested video properties. Verify duration, readable placement, encoding and caption sync after rendering. A subtitle file beside an uncaptioned video does not satisfy burned-in delivery.

Changing color, font or line breaks only rerenders captions. Do not regenerate the video or TTS. Deliver the captioned file and the editable timing file; retain the source video.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
