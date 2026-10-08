---
name: ffmpeg-audio
description: Attach, generate, detect, remove, and transcode audio with FFmpeg, including silence workflows and telephony formats such as G.711 μ-law, G.711 A-law, GSM, and PCM. Use when audio is the primary media concern.
---

# FFmpeg Audio

Use this skill for audio-first workflows. For attaching or adding silence tracks to video, prefer the canonical `video attach-audio` / `video add-silence` commands; the older audio-domain aliases remain compatible.

## Activation scope

Use for:

- attaching or replacing audio on video;
- generating silence;
- adding a silence track;
- detecting silence intervals;
- removing silence from audio-only media;
- telephony transcoding and codec/container clarification.

## Do not use

Do not use for video timing edits unless audio handling is secondary to the video operation. Do not use `remove-silence` on video when doing so would create A/V desynchronization; the toolkit intentionally restricts unsafe cases.

## Required inputs

Identify:

- input media;
- whether an existing audio track may be replaced;
- silence thresholds/durations when relevant;
- telephony codec, sample rate, channels, and container requirements.

## Preflight

Probe media when stream presence matters. Never assume a video lacks audio. For telephony, distinguish codec from container before building the command.

## Toolkit surface selection

Use the highest-level toolkit surface available to the host:

1. Use the associated `scripts/run.mjs` entry point for supported audio actions.
2. For silence detection, add-silence, telephony transcoding, or other supported audio operations, use `cecilia-ffmpeg`.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
4. Use native FFmpeg only when the toolkit lacks the required operation or the user explicitly requests native syntax.

## Associated scripts

Use `scripts/run.mjs` with `input.action` set to `attach`, `silence`,
`add-silence`, `detect-silence`, `remove-silence`, or `telephony`. Audio
inputs, codec/container choices, and output policy stay explicit in `input`;
the script returns typed intervals or an FFprobe-backed artifact report.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"detect-silence","input":"speech.wav","noiseDb":-35,"minDuration":0.5}}' \
  | node skills/ffmpeg-audio/scripts/run.mjs
```

## Preferred toolkit commands

```bash
cecilia-ffmpeg video attach-audio <video> <audio>
cecilia-ffmpeg audio silence
cecilia-ffmpeg video add-silence <video>
cecilia-ffmpeg audio detect-silence <input> --json
cecilia-ffmpeg audio remove-silence <input>
cecilia-ffmpeg audio telephony <input>
```

For supported operations, prefer the toolkit surface selected above over constructing arbitrary FFmpeg shell commands.

## Native FFmpeg fallback

Use native FFmpeg only when the toolkit lacks the required audio transform or the user explicitly asks for it. Keep channel layout, sample rate, sample format, codec, and container explicit.

## Output expectations

Silence detection should return typed intervals. File-producing operations should preserve non-audio streams according to the command contract and validate the result with FFprobe.

## Validation

Verify:

- audio codec;
- sample rate;
- channel count/layout;
- expected stream count;
- duration changes for silence removal;
- intended preservation/replacement behavior.

## Error recovery

- If existing audio would be destroyed, require explicit replacement intent.
- If a codec/container pairing is invalid, correct the container or codec rather than changing labels.
- If silence removal on video would desynchronize A/V, do not proceed with the audio-only workflow.
- If the user says “GSM μ-law”, clarify that GSM and G.711 μ-law are distinct codecs.

## Safety and determinism

Do not silently replace audio tracks. Do not conflate G.711 μ-law/PCMU, G.711 A-law/PCMA, GSM, and PCM.

## References

Read `references/audio-reference.md` for silence and telephony details.
