# Word Timing

Every word-anchored layer needs measured word times from the actual performance. Display
text always comes from the script; recognized speech only supplies time. Generated speech
is often mis-transcribed ("tier" heard as "-Ear", "Tea" as "T"), so never paste ASR text
into captions and never trust a guessed timestamp.

## Sources, in order of preference

1. **Existing word JSON** supplied by the user or another tool (openai-whisper, WhisperX,
   `{"words": [...]}` or `passages[].words[]` shapes). Convert with
   `"${PVX}" media transcribe --words-from <json> --to <words.json>`.
2. **Local aligner**: `whisperx` CLI, then the `whisper` CLI (openai-whisper), then the
   Python `whisper` module, whichever is installed. `"${PVX}" media transcribe <take.mp4>
   --language en --to <words.json>` extracts 16 kHz audio with FFmpeg and runs it.
   See `./local-tools.md` for installation and model cache notes. Nothing is downloaded
   by the plugin itself.
3. **TTS with fixed-window takes**: when narration is generated with `create voice` per
   caption (`subtitles voice-queue`), each clip's measured duration gives phrase timing
   without an aligner; word highlighting inside a phrase then stays off.

If none is available, say so. Deliver phrase-level captions from the plan only when the
user accepts an unmeasured timing draft, clearly labelled.

## Build the timeline

```bash
"${PVX}" timeline build --script projects/<slug>/script.txt \
  --take hook=projects/<slug>/assets/videos/<id>/take.mp4:projects/<slug>/words/hook.json@hook \
  --take body=projects/<slug>/assets/videos/<id2>/take2.mp4@body \
  --language en --to projects/<slug>/timeline.json
"${PVX}" timeline anchors projects/<slug>/timeline.json
```

`--take <id>=<media>[:<words.json>][@<segment>][+<start-seconds>]` places takes one after
another on the program clock (or at an explicit start). Missing word files are transcribed
locally. The output `pvx.timeline@1` holds every word with start/end, phrases, takes and
resolved anchors (`selection` windows, `moment` instants, `segment:<id>` and `program`).

## Check alignment before composing

- `confidence` is the share of script units matched exactly or as short, similar spelling
  substitutions. Interpolated timing alone is not a match. Below about 0.8, or when
  `needs_review` is true, listen to the flagged passage before composing or requesting a
  paid retake. ASR errors and performance errors need different repairs.
- `unmatched_words` have uncertain, interpolated timing; `extra_asr_words` lists inserted
  ASR speech. Neither proves a performance error. Verify against the audio, correct the
  transcript when ASR is wrong, or repair the take when the spoken script is wrong.
- `subdivided_asr_tokens` counts multi-unit ASR tokens split proportionally within their
  measured spans (for example, a CJK word containing several characters). Internal character
  timing is estimated, not forced alignment; check reveals that depend on that precision.
- For Chinese, Japanese or Korean, pass `--language zh|ja|ko`; alignment runs per character.
- Re-run `timeline build` after any new take. Anchors, captions and graphics follow.
