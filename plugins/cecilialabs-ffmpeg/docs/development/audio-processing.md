# Milestone 5 — Audio Processing Architecture

Milestone 5 introduces the first dedicated audio domain while preserving the deterministic runtime and output transaction established earlier.

## Domain structure

```text
src/audio/
├── types.ts
├── encoding.ts
├── helpers.ts
├── attach.ts
├── silence.ts
├── silence-detect.ts
├── remove-silence.ts
├── telephony.ts
└── index.ts
```

The package API exports these modules from `src/index.ts`.

## Execution model

```text
CLI / package API
      ↓
audio domain function
      ↓
FFprobe preflight (for existing inputs)
      ↓
typed validation / codec-container policy
      ↓
FFmpeg argument array
      ↓
runFFmpeg()
      ↓
spawn(..., shell: false)
      ↓
sibling temporary output
      ↓
atomic promotion
      ↓
FFprobe result validation
```

No Milestone 5 function executes a shell command string.

## Shared file I/O

The output transaction implementation moved from `src/video/io.ts` to `src/media/io.ts`. `src/video/io.ts` remains a compatibility re-export. This makes readable-file validation, deterministic output naming, overwrite protection, and transactional output staging available to audio and future media domains without duplicating logic.

## Audio attachment

`attachAudio()` accepts a video source and a dedicated audio source.

Modes:

- `replace`: source audio streams are replaced by the supplied audio;
- `append`: source audio is preserved and the supplied track is appended.

The supplied track is padded by default with `apad`, matching the useful behavior in the legacy script without using `eval`. When the source video duration is known, the output is explicitly bounded to that duration.

Video handling:

- `copy`: always stream-copy video;
- `encode`: re-encode using the existing video encoding profiles;
- `auto`: copy only when the video codec is compatible with the requested container.

## Silence generation

`generateSilence()` uses FFmpeg's `anullsrc` lavfi source and always generates a finite output.

Channel layouts are inferred for:

| Channels | Layout |
|---:|---|
| 1 | `mono` |
| 2 | `stereo` |
| 6 | `5.1` |
| 8 | `7.1` |

Other channel counts require an explicit FFmpeg channel-layout string.

## Silent video audio

`addSilenceToVideo()` creates a finite silent stream and maps it onto an existing video. It refuses to replace existing audio unless the caller explicitly sets `replaceExisting` / `--replace-existing`.

This is intentionally safer than the legacy script, which could silently discard existing audio depending on mappings.

## Silence detection

`detectSilence()` executes:

```text
silencedetect=noise=<threshold>dB:d=<duration>
```

FFmpeg reports detection events on stderr. The implementation parses those diagnostics into the canonical contract:

```ts
interface SilenceInterval {
  start: number;
  end: number;
  duration: number;
}
```

The report also contains total detected silence and, where FFprobe supplies duration, estimated non-silent duration.

## Silence removal

`removeSilence()` uses a deterministic `silenceremove` graph rather than creating segment files and a concat list as the Bash prototype did.

The filter removes qualifying silence at the beginning and repeatedly throughout the audio while optionally retaining a small amount around cuts.

Milestone 5 intentionally rejects inputs containing video. Removing elapsed time from an audio stream while leaving video timestamps unchanged would create A/V desynchronization. Synchronized audiovisual timeline removal belongs in a later composition/timeline milestone.

## Telephony model

Telephony output separates codec from container.

| Public codec | FFmpeg encoder | Default container | Default rate | Default channels |
|---|---|---|---:|---:|
| `mulaw` | `pcm_mulaw` | WAV | 8000 Hz | 1 |
| `alaw` | `pcm_alaw` | WAV | 8000 Hz | 1 |
| `gsm` | `libgsm` | raw GSM | 8000 Hz | 1 |
| `pcm` | `pcm_s16le` | WAV | 8000 Hz | 1 |

Raw containers are also modeled explicitly:

- μ-law → `mulaw` muxer (`.ulaw` / `.mulaw`);
- A-law → `alaw` muxer (`.alaw`);
- GSM → `gsm` muxer (`.gsm`);
- signed 16-bit PCM → `s16le` muxer (`.s16le` / `.pcm`).

This directly fixes the semantic problem in `convert-audio-to-gsm-ulaw.sh`, which encoded G.711 μ-law but named the destination `.gsm`.
