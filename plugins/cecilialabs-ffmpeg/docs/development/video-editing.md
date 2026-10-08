# Milestone 4 — Video Editing Architecture

Milestone 4 is the first media-mutating domain layer in FFmpeg Media Toolkit. It builds exclusively on the Milestone 2 execution boundary and Milestone 3 FFprobe normalization.

## Public operations

```text
video trim-start <input>
video trim-end <input>
video trim <input>
video speed <input>
video from-image <input>
video restore <input>
```

The package API exposes the corresponding functions:

```ts
trimVideoStart()
trimVideoEnd()
trimVideoRange()
changeVideoSpeed()
createVideoFromImage()
restoreVideo()
```

## Execution flow

```text
CLI / library caller
      ↓
validate semantic options
      ↓
resolve readable input
      ↓
FFprobe input inspection (when media metadata is required)
      ↓
build typed FFmpeg argument array
      ↓
prepare sibling temporary output
      ↓
runFFmpeg(shell: false)
      ↓
validate non-empty temporary artifact
      ↓
atomic-style final rename
      ↓
FFprobe final output
      ↓
VideoOperationReport
```

No Milestone 4 operation shells out through Bash, `eval`, `exec`, or a string command.

## Trim semantics

### `auto`

`auto` resolves to `accurate` in v0.2.0. The key property of the default mode is deterministic temporal semantics rather than maximum throughput.

### `copy`

Uses stream copy and avoids transcoding. This is fast but the physical cut point can depend on keyframe and timestamp behavior. The operation therefore emits `W_TRIM_KEYFRAME_DEPENDENT`.

### `accurate`

Seeks after input opening and re-encodes video/audio while preserving other mapped streams with stream copy where possible.

Output encoding is selected from the destination container:

| Output | Video | Audio |
|---|---|---|
| MP4 / M4V / MOV / MKV | H.264 (`libx264`) | AAC |
| WebM | VP9 (`libvpx-vp9`) | Opus |

## Range validation

`video trim` accepts:

```text
--start S --end E
```

or:

```text
--start S --duration D
```

but never both `--end` and `--duration`. FFprobe duration is used to reject ranges that start outside or extend beyond a known input duration.

`video trim-end` always inspects duration because removing *N seconds from the end* requires a reliable retained duration.

## Speed semantics

Video timing uses:

```text
setpts=PTS/factor
```

Audio defaults to synchronized speed using one or more `atempo` stages. To remain compatible with conservative FFmpeg ranges, factors are decomposed into stages between `0.5` and `2.0`.

Examples:

```text
4.0  → atempo=2,atempo=2
0.25 → atempo=0.5,atempo=0.5
2.5  → atempo=2,atempo=1.25
```

`--audio drop` intentionally removes audio.

## Still-image clips

`video from-image` provides explicit duration, resolution and FPS. Input aspect ratio is preserved with:

```text
scale(... force_original_aspect_ratio=decrease)
→ pad(target resolution)
→ setsar=1
→ format(pixel format)
```

The default target remains `1920x1080`, matching the intent of the original Bash utility while removing `eval` and hard-coded filenames.

## Restore profiles

### Balanced

A conservative resize/normalization chain:

```text
scale → pad → setsar
```

### Aggressive

Preserves useful restoration knowledge from the legacy scripts:

```text
bwdif
→ deblock
→ hqdn3d
→ nlmeans
→ scale/pad
→ unsharp
```

Unlike the legacy files, `HD` and `FHD` are never inferred from incorrect dimensions. Resolution is always explicit as `WIDTHxHEIGHT`.

## Output transaction

Media mutations never write directly to the requested final path. The toolkit stages output as a unique sibling:

```text
.<name>.cecilia-ffmpeg.<uuid>.tmp.<extension>
```

This preserves FFmpeg format inference while preventing partially written artifacts from appearing under the final filename.

Finalization rules:

1. Reject input/output path equality.
2. Reject existing destination unless `--overwrite` is enabled.
3. Write to sibling temporary output.
4. Require successful FFmpeg exit.
5. Require a non-empty output file.
6. Replace destination only after successful processing when overwrite was explicitly requested.
7. Rename temporary artifact to final path.
8. Re-probe final output.
9. Remove failed temporary artifacts unless `--keep-temp` is explicitly requested.

## Dry-run semantics

Milestone 4 dry-run performs read-only FFprobe inspection when required to construct a valid plan, but it does **not** execute the mutating FFmpeg transformation and does not create output directories/files.

The planned FFmpeg invocation still targets the generated temporary sibling path so humans and agents can inspect the exact command topology.
