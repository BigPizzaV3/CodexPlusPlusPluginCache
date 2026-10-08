# Audio Reference

## Telephony formats

| User intent | FFmpeg codec | Typical sample rate | Typical container |
|---|---|---:|---|
| G.711 μ-law / PCMU | `pcm_mulaw` | 8000 Hz | WAV or raw μ-law as required |
| G.711 A-law / PCMA | `pcm_alaw` | 8000 Hz | WAV or raw A-law as required |
| GSM | `libgsm` / GSM codec | 8000 Hz | GSM |
| Linear PCM | `pcm_s16le` | configurable | WAV |

Codec and container are independent decisions.

## Silence detection

Use `audio detect-silence --json` when another workflow needs machine-readable intervals.

## Silence removal

The current toolkit intentionally limits silence removal to audio-only media when video synchronization cannot be preserved safely.

## Attach behavior

Choose replacement versus append behavior deliberately. Padding and shortest-stream semantics should be explicit for bounded media outputs.
