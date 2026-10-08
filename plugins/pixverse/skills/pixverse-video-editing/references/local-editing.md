# Local Editing Recipes

Use FFmpeg/ffprobe already available on the host. These examples use simple file names;
construct argument arrays or quote actual paths correctly. Keep input files intact and use
a new output path. All times below are seconds. Inspect stream layout once before choosing
a recipe; exact words, graphics and UI belong in deterministic layers.

## Accurate Cut

For seconds 2 through 7 of a clip, decode and re-encode the five-second selection:

```bash
ffmpeg -nostdin -n -ss 2 -i input.mp4 -t 5 -map 0:v:0 -map '0:a:0?' -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac cut.mp4
```

Stream copying is faster when keyframe accuracy is acceptable. Do not advertise a
keyframe-aligned copy as a frame-accurate cut. Keep variable-frame-rate source timing unless
the output timeline requires a specific rate. Update caption/cue times after trimming.

## Mixed Sources Into One Timeline

Normalize each selected source interval to the target dimensions, square pixels, frame
rate, audio rate and channel layout. Reuse normalized clips for alternate cuts. For a
landscape canvas, the fit filter can be:

```text
scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30
```

Use the same codec/encoding settings for each intermediate. Explicitly preserve and pad
its audio to that interval, or add a matching silent track to a silent source. For example,
normalize a five-second source that has audio:

```bash
ffmpeg -nostdin -n -ss 2 -i input.mp4 -t 5 -map 0:v:0 -map 0:a:0 -vf 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30' -af apad -ar 48000 -ac 2 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac normalized.mp4
```

For a silent source, supply `-f lavfi -i anullsrc=r=48000:cl=stereo`, map `1:a:0`,
and keep the explicit five-second output bound. Do not point a required map at absent audio.
Concatenate the normalized files in the requested order. For a small number of clips,
a single filter graph using per-source `trim`, `atrim`, `setpts`, `asetpts` and `concat`
also avoids intermediate renders. Each clip's video and audio must start at timestamp zero
before the concat filter.

Use a hard cut by default when no transition is requested. A dissolve shortens the combined
duration by its overlap; move downstream captions and sound cues to the resulting timeline.

## Reframe Without Distortion

For an explicitly centered vertical crop:

```text
scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1
```

For full-frame fit with borders:

```text
scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1
```

Choose fit versus crop from the requested treatment. For an off-center or moving subject,
inspect representative moments and use shot-specific crop positions or keyframes. A center
crop is not face tracking. Preserve a crop decision in the cut list so later edits can reuse it.

## Change Speed With Sound

For 1.25× speed with source audio, combine `setpts=(PTS-STARTPTS)/1.25` with
`atempo=1.25,asetpts=PTS-STARTPTS`. A five-second source becomes four seconds. If audio is
absent, omit the audio filter. For large factors, chain conservative `atempo` factors
between 0.5 and 2.0 whose product is the desired speed. Retime subtitles and overlays too.
Do not claim optical-flow slow motion from timestamp changes or duplicated frames.

## Preserve Or Replace Sound Deliberately

- Caption, color or crop-only edits normally retain the accepted soundtrack.
- To remove audio, map video and use `-an`; do not assume a generation parameter made it silent.
- To replace sound, map only the chosen new track, then trim or pad it to the picture duration.
- To add music, preserve original dialogue, set a sensible bed level and adjust by listening.
  Static volume is not automatic dialogue ducking. Use sidechain compression only when
  a usable speech control signal is actually available.

Save the source intervals and command/filter graph alongside the master for reproducible
revision. Check the properties changed by this edit; elaborate shot analysis and a full
media QA pass are separate requests.
