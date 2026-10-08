# Milestone 3 — Environment Inspection and Media Probe

Milestone 3 converts the generic Milestone 2 process runtime into reliable read-only FFmpeg/FFprobe introspection APIs and CLI commands.

## Implemented CLI

```bash
cecilia-ffmpeg doctor
cecilia-ffmpeg environment version
cecilia-ffmpeg environment capabilities
cecilia-ffmpeg probe <input>
```

All commands support the existing global options, including `--json`, `--verbose`, explicit binary paths, and `--dry-run`.

## Layering

```text
CLI action
   ↓
environment/* or media/* service
   ↓
runFFmpeg() / runFFprobe()
   ↓
Milestone 2 process boundary
   ↓
ffmpeg / ffprobe
```

No Milestone 3 domain module executes child processes directly.

## Version policy

`environment version` executes:

```text
ffmpeg -version
ffprobe -version
```

and normalizes their first lines into `BinaryVersion` structures.

The compatibility boundary frozen in Milestone 0 remains:

```text
FFmpeg >= 6.1
```

Unknown/non-numeric development version strings are reported rather than guessed.

## Capability inspection

The capability service executes these read-only commands:

```text
ffmpeg -hide_banner -codecs
ffmpeg -hide_banner -encoders
ffmpeg -hide_banner -decoders
ffmpeg -hide_banner -filters
ffmpeg -hide_banner -hwaccels
```

Each table is parsed into typed objects instead of being exposed as console text.

### Hardware semantics

Hardware reporting is deliberately conservative. A backend marked `compiled: true` means FFmpeg reports a relevant accelerator and/or compiled encoder. It does **not** mean a compatible GPU, driver, device node, permission set, or runtime session is usable.

For example, NVENC is considered compiled when an encoder such as `h264_nvenc`, `hevc_nvenc`, or `av1_nvenc` is present. A reported `cuda` hardware method alone is not treated as proof of NVENC encoding availability.

Actual device initialization is intentionally deferred to hardware-acceleration work in a later milestone.

## Doctor semantics

`doctor` composes version and capability inspection and returns:

- runtime platform and architecture;
- Node.js version;
- FFmpeg/FFprobe paths and versions;
- codec/encoder/decoder/filter counts;
- hardware acceleration methods;
- compiled/reported hardware backend summaries;
- warnings and overall status.

Doctor status is one of:

```text
ok
warning
error
planned
```

`planned` is used for `--dry-run`.

A doctor command may successfully execute while diagnosing an unhealthy environment. In that case the JSON envelope can remain a successful command result while `data.status` is `error` and the process exit status signals the environment failure.

## Probe contract

`probe` validates the input as a readable regular file and invokes:

```text
ffprobe -v error -show_format -show_streams -of json <input>
```

The raw JSON is normalized to `MediaInfo`.

```ts
interface MediaInfo {
  source: string;
  format: MediaFormat;
  streams: MediaStream[];
  video: VideoStream[];
  audio: AudioStream[];
}
```

FFprobe often serializes numeric values as strings. The normalizer converts appropriate values to JavaScript numbers while retaining rational values such as `30/1` and `1/15360` as strings.

`streams` is a discriminated union covering video, audio, subtitle, data, attachment, and unknown streams. Convenience `video` and `audio` arrays provide typed subsets without discarding other streams.

## Bounded output

FFprobe JSON capture is limited to 16 MiB. Truncation is never silently parsed. A truncated JSON document maps to `E_PROBE_FAILED`.

Capability table capture uses an 8 MiB bound per FFmpeg process.

## Dry-run

Inspection commands honor the global dry-run contract:

- binaries are resolved;
- input paths are validated where applicable;
- intended process invocations are generated;
- no FFmpeg/FFprobe process is spawned;
- data that requires process output is intentionally absent/empty;
- the result is marked `planned`.
