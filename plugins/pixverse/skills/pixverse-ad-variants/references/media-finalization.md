# Restore The Source Soundtrack And Verify The Edit

These checks are specific to an ad edit promising source preservation. Use local FFmpeg
and ffprobe after the ordinary queue has downloaded its result. Preserve successful jobs;
delivery or muxing failures never require a new video generation.

## Measure Before Editing

Probe the source once with `ffprobe -v error -show_streams -show_format -of json`.
Select the default non-cover-art video stream, or the first non-cover-art video if none
is marked default. Select the default audio stream, or the first audio; absence means
the final must remain silent. Store their absolute stream indices.

Retain container duration, video duration/frame count, frame rate, coded dimensions,
sample aspect ratio, display rotation and both stream start times. Compute display aspect
with sample aspect ratio and rotation. Use positive finite container duration, falling back
to video duration, for the 4–30 second intake gate. Keep container and video duration
separate: AAC packet padding can extend the container past the last video frame.

Audio offset is selected-audio start minus primary-video start, or zero if either is
unavailable. Keep cut frames and difficult interaction moments for comparison. A scene
detector is a candidate boundary finder, not proof of exact cuts.

## Restore Without Hiding Timing Drift

Check that the generated video covers the source's full visible action before muxing.
Do not freeze, loop or stretch short motion to make the duration gate pass. Inspect lip
and cut timing before using the original speech. Report a drift as a visual-preservation
failure even when the exported audio is technically correct.

For an audible source with matching start times, this pattern uses the selected source
stream and discards generated audio. Resolve stream indices and duration from the probe:

```bash
ffmpeg -nostdin -y -i "$RAW_VIDEO" -i "$SOURCE_VIDEO" \
  -filter_complex "[1:$SOURCE_AUDIO_INDEX]asetpts=PTS-STARTPTS,apad=whole_dur=$SOURCE_DURATION,atrim=duration=$SOURCE_DURATION[source_audio]" \
  -map "0:$RAW_VIDEO_INDEX" -map '[source_audio]' -t "$SOURCE_DURATION" \
  -c:v copy -c:a aac -b:a 192k -movflags +faststart "$FINAL_VIDEO"
```

For a positive audio offset, insert `adelay=<offset in milliseconds>:all=1` before the
shown filter chain. For a negative offset, prepend `atrim=start=<absolute offset seconds>`.
For a silent source map only the generated video stream and use `-an`. Do not add music,
TTS or generated voice. Do not use `-shortest` or shift the inherited video timestamps to
conceal an audio/duration mismatch. A normal one-frame audio padding difference is not
evidence of missing source action.

## Acceptance Evidence

Probe each final. Require playable video, the selected display resolution, source display
aspect, duration and correct audio presence. Use a duration tolerance of
`max(1 / source_fps, 0.10)` seconds, display-aspect relative error at most 1.5%, and displayed
short edge within 8 pixels of the chosen 720 or 1080 pixels. Never silently upscale a
low-resolution generation to claim native 1080p. Track any deliberate export transform.

For source-audio verification, compare the decoded selected track with the restored final
over their common time span, allowing only the expected AAC re-encoding difference and
the measured offset/padding. A stream's presence alone does not prove unchanged speech.
Check cut boundaries, opening occlusions, hands and product details across the whole clip;
record uninspected properties explicitly. Separate visual fidelity, technical file checks
and audio-preservation results rather than presenting one as proof of the others.

Deliver the restored files in original output order, with specific preservation failures
visible. In a user-requested benchmark, retain each first attempt, the exact prompt and
input mapping; do not silently repair one branch and compare it with another's first take.
