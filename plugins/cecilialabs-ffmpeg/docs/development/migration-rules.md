# Legacy Migration Rules

The Bash corpus is behavioral evidence, not an implementation contract. Migration extracts **intent and useful FFmpeg knowledge**, then corrects unsafe, misleading, obsolete or hard-coded behavior.

## 1. Rules

1. Do not perform line-by-line Bash-to-TypeScript translation.
2. Replace hard-coded paths, filenames, durations and dimensions with validated options/default profiles.
3. Replace `eval` with direct process execution using argument arrays.
4. Replace shell loops with Node filesystem traversal.
5. Replace `awk` parsing with structured parsing in TypeScript where possible.
6. Use FFprobe JSON for media metadata rather than text scraping when possible.
7. Preserve deliberate media behavior only after documenting it (for example `-an` in speed-up operations).
8. Make stream selection explicit when input ordering could change automatic mapping.
9. Detect required filters/encoders before executing specialized operations.
10. Prefer native FFmpeg implementations over extra utilities unless an external binary is justified.
11. Preserve third-party license attribution when porting third-party algorithms/code.
12. Validate output with FFprobe in integration tests.

## 2. Behaviors specifically forbidden from literal reproduction

### `eval ffmpeg ...`

Forbidden. It creates quoting/injection fragility and unnecessary shell dependence.

### `cd` into hard-coded or assumed directories

Forbidden as command behavior. Paths are arguments resolved from the caller's working directory.

### Mislabeling formats/transports

The new API names the actual semantic operation, not the historical filename.

Examples:

- `crop-x-seconds-from-start.sh` is trimming, not cropping.
- `stream-to-websocket.sh` emits MPEG-TS to an HTTP URL, not a WebSocket directly.
- `convert-all-gif-in-folder-to-webm.sh` currently outputs GIF, so its filename cannot define the migrated behavior.

### Conflating telephony codec/container concepts

`pcm_mulaw` (G.711 μ-law/PCMU) and GSM are separate codec/container decisions. The new command models codec, sample rate, channels and container independently.

### Misleading resolution labels

- 1280×720 is HD, not Full HD.
- 720×404 is a 16:9 low-resolution profile, not standard HD.

The new API uses explicit resolutions and optional named profiles whose dimensions are canonical and documented.

### Unsafe audio segment copying

The silence-removal script's intermediate `.wav` files with `-c copy` and final container transitions are not carried forward. Silence intervals are parsed into typed data, retained segments are composed intentionally, and the output codec/container is explicit.

### Global wildcards across temporary animated-WebP frames

Temporary frames are isolated per job/request. No `*.webp` wildcard may accidentally capture files from another conversion.

## 3. Deprecation modernization

Legacy FFmpeg options that are deprecated or version-sensitive (for example numeric `-vsync`/older async patterns) should be replaced by current equivalents where practical, with compatibility tests against the supported FFmpeg matrix.

## 4. Specialized filter policy

`gltransition` may depend on a custom FFmpeg build/filter not present in standard installations. The migrated transition operation must:

1. probe filter availability;
2. expose a clear capability error when unavailable;
3. provide built-in transition alternatives where feasible.
