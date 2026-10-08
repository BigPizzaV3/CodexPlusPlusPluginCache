# Audio Craft

PixVerse can create video with prompted audio, standalone voice, and standalone music. Choose intentionally. For high-quality film/trailer/commercial work, write the sound intention as plainly as the visual intention.

## Sound Design Principle

Do not assume `--audio` understands shorthand labels. Video-model audio can contain baked music, musical swells, generic ambience, or low-quality SFX when the prompt mixes trailer/music language with SFX language. If the goal is synchronized sound effects and ambience, say that in natural language.

A specialized workflow’s native-dialogue, voiceover, music and timing recipe takes
precedence over the generic hierarchy. In particular, product/creator UGC must keep
its complete native voice map; exact words do not automatically imply separate TTS.

Default hierarchy:

| Need | Prefer |
|---|---|
| quick one-shot demo, UGC native clip, casual social result | video `--audio` can be acceptable |
| trailer/film/commercial with synced ambience/SFX | video `--audio` with a plain natural-language no-music instruction, then QA |
| exact off-screen narration | standalone voice in natural sections, then measured timing and local mix |
| exact visible dialogue | native speech shots or an actually supported sync route; new TTS alone does not repair lips |
| reusable score | standalone music, then local trim/fade/duck |
| precise Foley/ambience | user-provided or local/library SFX stems; do not pretend current PixVerse CLI has standalone SFX generation |

If a generated video track contains unwanted music or bad ambience/SFX, reject that audio. Do not mix more music on top of it and call it finished.

The `--audio`/`--no-audio` examples apply only to models exposing those CLI switches.
Seedance 2.5 omits both switches and uses provider defaults; preserve sound directions in the
prompt, inspect the result, and mute during export if silence is required. An absent toggle
does not establish that native audio is unsupported.

## In-Clip Audio

Use prompt sections like:

```text
Dialogue: ...
SFX: ...
Music: ...
```

Good for single-shot social clips where audio is part of the generated moment and the user can accept a baked, non-editable track.

For Seedance 2.5 dialogue continuity across shots, prefer reference video mode with image/video references plus `--audios` voice references. Use concise, clean voice references and keep total audio duration/count within the current CLI limits, and still write the exact dialogue in the shot prompt. Do not include generated music in those video prompts; score the edit later.

For film, trailer, drama, commercial, and animation shots, `--audio` is appropriate when the brief wants the video model to synchronize ambience and effects to the motion. The prompt must describe that goal directly in natural language. Do not rely on a terse `Music: none` line after using music-shaped words elsewhere.

Avoid musical words in SFX/ambience prompts: `swell`, `chime`, `stinger`, `orchestral`, `trailer hit`, `magical score`, `uplifting bed`, `heroic sound`, or emotional music direction. Use physical words tied to visible events: paws on wood, cloth rustle, window latch, soft breath, wind through an open window, distant town room tone.

Safer in-clip audio prompt shape:

```text
This video should not generate any music, background music, score, melody, rhythmic bed, or trailer-style musical hit.
Only generate synchronized sound effects and environmental ambience for what is visible in the shot.
The sound should be natural and quiet: physical Foley from the characters and objects, room tone, air, water, footsteps, fabric, breath, and other diegetic sounds.
Do not add orchestral emotion, musical chimes, melodic pads, percussion, or any soundtrack-like layer.
```

Even with that prompt, QA the audio. Unwanted baked music is a hard failure when the plan was diegetic-only audio.

`quote queue` may add an advisory note when a video task uses `--audio` without explicit no-music language. Treat it as a quick reminder, not a blocker. If the prompt already says "no music" or the user's intent is clear, keep moving to confirmation; do not switch to `--no-audio` or redesign the route only to silence the note.

## Sound Cue Sheet

For serious work, write a cue sheet before final audio work:

| Time | Visual beat | Required sound | Source | Notes |
|---|---|---|---|---|
| 00:00-00:03 | door opens | hinge creak, room tone | local/user SFX | no music yet |
| 00:03-00:07 | character runs | footsteps, cloth rustle | local/user SFX | pan with motion |

Use the cue sheet to decide what can be solved locally, what needs generated voice/music, and what would require another paid video/audio generation.

## Standalone Voice

Use `pixverse create voice` when:

- narration timing matters
- the user needs downloadable audio
- subtitles will be derived from a script
- the voice should be mixed under/over an existing video

## Actual Audio And Timed Takes

For normal narration, preserve the accepted spoken text and generate natural thought/breath
sections. Measure and listen to the returned audio, then align the captions and visuals to it.
One subtitle does not require one voice task. A script's estimated timings are not measured
speech, and ffprobe can measure duration but cannot transcribe or align words.

For user-supplied fixed time windows, prepare an SRT/take list first and use
`subtitles voice-queue` when independent timed takes are appropriate. Compare each returned
take with its target window. Align captions and use available lead/tail silence; rewrite and regenerate only editable
failed takes when needed. Do not slow speech or time-stretch it to fill a window; never
truncate spoken words to fit. An explicit user-requested retime is a separate edit. Regeneration still follows preflight and confirmation.

Use `../skills/pixverse-voiceover/SKILL.md` for natural or timed speech production and
`../skills/pixverse-captions/SKILL.md` for accurate alignment and burned delivery. Keep exact
spoken text and timed display text related but distinct when translation or display cleanup
requires it. Use one canonical timed subtitle file for the final render.

The helpers below inspect or prepare supplied text; none is an automatic speech recognizer:

```bash
"${PVX}" subtitles clean projects/<slug>/prompts/narration.srt projects/<slug>/prompts/narration.clean.srt
"${PVX}" subtitles inspect projects/<slug>/prompts/narration.clean.srt
"${PVX}" subtitles style
"${PVX}" subtitles voice-queue projects/<slug>/prompts/narration.clean.srt projects/<slug>/voice-queue.json --project <slug> --segments-dir projects/<slug>/prompts/tts-segments --voice-id <voice_id> --language zh
"${PVX}" quote queue projects/<slug>/voice-queue.json
"${PVX}" subtitles text projects/<slug>/prompts/narration.srt
"${PVX}" subtitles text projects/<slug>/prompts/narration.srt --output projects/<slug>/prompts/narration.txt
"${PVX}" subtitles split projects/<slug>/prompts/narration.srt --output-dir projects/<slug>/prompts/tts-segments
```

`subtitles clean` strips sentence-ending display punctuation such as `.`, `。`, `!`, `？`, commas, and ellipses from caption line ends. Use it when that typography is wanted; retain the canonical spoken text. `subtitles voice-queue` is for an explicit timed-take plan, not a quality requirement for all captioned video. Quote every resulting voice task and avoid multiplying requests merely because captions have short display lines.

Use `"${PVX}" subtitles style --format force-style` when burning SRT with FFmpeg. The default 1080p horizontal style is `Fontsize=18` and `MarginV=28`; larger subtitle sizes require a deliberate visual reason.

## Standalone Music

Use `pixverse create music` when:

- the user explicitly asks for music/BGM
- cross-shot continuity matters
- you need a reusable soundtrack
- the video model should focus on picture/dialogue while music stays replaceable in post

## Music Duration Rule

Default to auto-duration generation for ordinary soundtrack work. A target duration
is also a supported CLI capability; preserve an explicit user request after reading
`"${PVX}" pixverse capabilities create music --model <id> --json`.

For music-led motion design, choose the returned music excerpt and measure its beat
timing before locking the picture edit; follow
`../skills/pixverse-motion-design/references/beat-sync.md`. A BPM requested in a prompt
is a creative target, not a measurement of the generated audio.

Default pattern:

```bash
pixverse create music --model music-2.6 --prompt <prompt-file> --instrumental --json
```

PixVerse music generates at automatic duration. The live service rejects a fixed target
(`duration_seconds is reserved, please use duration_auto`, 400017), so the queue refuses
`--duration-seconds` and `--no-duration-auto` before any paid work. Preserve an explicit user
request for a target length as an editing requirement: measure the returned audio and trim,
loop, fade or duck locally to the picture. Do not silently substitute another model.

Music 3.0 and Music V2 support separate lyrics, auto lyrics and instrumental mode;
choose one intent. Lyria supports auto lyrics, instrumental and up to 10 image
references, but not separate `--lyrics`. Put lyric direction in its prompt. Other
music models do not accept image references. See `./pixverse-cli-1.4.4.md` for the
current review. Canvas manual duration still requires a live adapter field mapping;
ordinary Create flags do not establish Canvas support.

## Mixing Defaults

- Dialogue must beat music.
- Duck BGM under voice.
- Avoid lyrics under spoken narration unless user wants that tension.
- For film/trailer workflows, keep generated SFX/ambience only after audio QA proves it has no unwanted music and is pleasant enough to use.
- If generated in-clip audio is bad, strip it with `ffmpeg -an` or replace it in the mix; do not bury it under music.
- For ads, let SFX mark product beats.
- For MV, the music owns the edit rhythm.

For Seedance 2.5 video, apply `../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` and the
1080p default in `./quality-policy.md`; its CLI has no audio toggle.
