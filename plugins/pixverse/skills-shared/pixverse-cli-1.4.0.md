# PixVerse CLI 1.4.0 Capability Baseline

For the latest reviewed npm release, read `./pixverse-cli-1.4.5.md`. This file records the minimum supported floor.

This is plugin `1.3.2`'s minimum, human-reviewed capability baseline. The managed online runtime
installs npm `latest` and accepts only `pixverse>=1.4.0`; these commands and capability domains are the
guaranteed floor. Use `pvx doctor` to verify the active version and the live CLI's own offline
`capabilities create` output for model-specific parameter details.

Published source contract: `pixverse@1.4.0`, capabilities schema `1.2.0`, 93 commands, SHA-256
`fa44fe078976ed7cdb2131c44d92059787bcd207ca5c2ac722116022c953f3e3`, npm integrity
`sha512-AWf9dYvrfPQozaaqgESdJQK7HVNc6kiTKXyAmNM0AswmTrXNXj3bYdDcC+SjALWm/NoZPD2LX5KKMQCcerE23w==`.

## Capability Discovery

- `pixverse capabilities --json` and `pixverse capabilities create [mode] --model <id> --json` expose
  the normalized Create contract offline, without login or a network request.
- The Create capability domain is authoritative for required fields, defaults, enums, ranges, units,
  model support, and reference-media limits.
- The plugin canonicalizes the two reviewed `create reference` duration encodings to string seconds
  plus `auto`; public numeric `0` is the CLI's `auto` sentinel, not a literal zero-second duration.
- Canvas contracts are live and authenticated: use `pixverse capabilities canvas --json`, with
  `pixverse canvas node schema --node-type <type> --json` only as a targeted fallback.
- `create reference` requires a non-empty prompt.
- Global region accepts `global` or `cn`; `PIXVERSE_REGION` overrides `--region`.

## Operational Changes Retained

- Process exit code `7` means `CONCURRENCY_LIMIT`; wait for a slot and retry the same intent instead
  of treating it as an ordinary failure.
- `task status` accepts space-separated positional ids; `--ids 123,456` remains valid for compact
  batch polling.
- `create upscale` targets only `2160p` and defaults to it.
- Google Lyria 3 Pro supports auto lyrics, instrumental generation, and image references. Put
  lyric-like direction in `--prompt`; it does not support a separate `--lyrics` value.
- Read-only `miniapps list` and `miniapps info` are available. Paid `miniapps create` remains outside
  the plugin queue until it has dedicated preflight, receipt, polling, and recovery support.

## Video Models

| Model id | Quality | Duration | Aspect notes |
|---|---|---|---|
| `v6` | 360p–1080p | 1–15s | broad ratios including `3:2`, `2:3`, `21:9` |
| `pixverse-c1` | 360p–1080p | 1–15s | broad ratios through `2:3` |
| `seedance-2.0-standard` | 480p–2160p | 4–15s | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9` |
| `seedance-2.0-fast`, `seedance-2.0-mini` | 480p, 720p | 4–15s | same Seedance ratios |
| `seedance-2.5` | 480p–1080p | 4–30s | automatic framing/duration and expanded references; no CLI audio toggle, native sound uses provider defaults |
| `minimax-h3` | 768p, 1440p | 5–15s | T2V fixed ratios, I2V auto; mixed reference and two-frame transition |
| `flux-3.0` | 720p, 1080p | 5–20s | video/I2V only; includes `2:1`; generated audio supported |
| `wan-3.0` | 480p–1080p | 2–30s | video, reference, and two-frame transition; generated audio supported |
| `gemini-omni-flash` | 720p | 3–10s | `16:9`, `9:16` |
| `happyhorse-1.0` | 720p, 1080p | 3–15s | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` |
| `kling-o3-pro`, `kling-o3-standard`, `kling-3.0-pro`, `kling-3.0-standard` | model-controlled; omit `--quality` | 3–15s | `16:9`, `9:16`, `1:1` |
| `kling-o3-4k`, `kling-3.0-4k` | 4K model tier; omit `--quality` | 3–15s | same Kling ratios; O3 also supports reference |
| `grok-imagine-1.5` | 480p, 720p, 1080p | 1–15s | image-to-video only; ratio comes from input image |
| `grok-imagine` | 480p, 720p | 1–15s | broad ratios through `2:3` |
| `veo-3.1-lite` | 720p, 1080p | 4/6/8s | `16:9`, `9:16` |
| `veo-3.1-standard`, `veo-3.1-fast` | 720p–2160p | 4/6/8s | `16:9`, `9:16` |
| `sora-2-pro` | 720p, 1080p | 4/8/12s | `16:9`, `9:16` |
| `sora-2` | 720p | 4/8/12s | `16:9`, `9:16` |
| `v5.6` | 360p–1080p | 1–10s | broad ratios through `2:3`; `v5.5`/`v5` belong to the specialized modes below |

## Mode Support

| Mode | Supported model families |
|---|---|
| `create video` | v6, C1, Seedance 2.0/2.5, MiniMax H3, FLUX 3, Wan 3.0, Gemini Omni, Happy Horse, Kling including 4K, Grok, Veo, Sora, v5.6 |
| `create reference` | v6, C1, Seedance 2.0/2.5, MiniMax H3, Wan 3.0, Gemini Omni, Kling O3 including 4K, Grok Imagine, v5.6 |
| two-frame `create transition` | v6, C1, Seedance 2.0/2.5, MiniMax H3, Wan 3.0, Kling including 4K, Veo 3.1, v5.6 |
| 3+ frame `create transition` | v5 only |
| `create extend` | v6 or `grok-imagine` |
| `create modify` | v5.5 only |
| `create motion-control` | v5.6 only |
| `create upscale` | 2160p only |

Seedance 2.5 reference accepts up to 30 images, 10 videos, 10 audios, and 50 reference items total.
Wan 3.0 reference accepts up to 10 images, 5 videos, 5 audios, and 20 items total; audio-only input is
allowed. Query the offline model capability before writing a command instead of copying these maxima as
defaults.

## Image Models

| Model | Model id | Quality |
|---|---|---|
| GPT Image 2 | `gpt-image-2.0` | 1080p, 1440p, 2160p; supports `--detail-level low|medium|high` |
| Nano Banana 2 | `gemini-3.1-flash` | 512p, 1080p, 1440p, 2160p |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite` | 1080p |
| Qwen Image | `qwen-image` | 720p, 1080p |
| Nano Banana Pro | `gemini-3.0` | 1080p, 1440p, 2160p |
| Nano Banana | `gemini-2.5-flash` | 1080p |
| Seedream 5.0 Pro | `seedream-5.0-pro` | 1080p, 1440p; up to 10 references |
| Seedream 5.0 Lite | `seedream-5.0-lite` | 1440p, 1800p, 2160p; up to 6 references |
| Seedream 4.5 | `seedream-4.5` | 1440p, 2160p; up to 6 references |
| Seedream 4.0 | `seedream-4.0` | 1080p, 1440p, 2160p; up to 6 references |
| Kling Image O3 / V3 | `kling-image-o3`, `kling-image-v3` | O3: 1080p–2160p; V3: 1080p/1440p |

## Audio Models

- Voice: `speech-2.8-hd`, `speech-2.8-turbo`, `eleven-multilingual-v2`, `eleven-v3`,
  `eleven-turbo-v2.5`.
- Music: `music-3.0`, `music-2.6`, `music-v2`, `music-v1`, `lyria-3-pro-preview`.
- Browse live account-visible catalogs with `pixverse voice models --json`,
  `pixverse voice presets --json`, and `pixverse music models --json`.

## Operational Surface

The reviewed CLI also exposes auth, task status/wait, asset list/info/download/upload/delete, account
info/usage/slots, subscribe, config/defaults, template discovery, voice/music catalogs, saved folders,
workspace switching, region selection, offline Create capabilities, live Canvas capability discovery,
and update commands. Inside this plugin, use `pvx` wrappers and refresh the private CLI with
`pvx bootstrap --yes`; do not bypass the managed runtime with CLI self-update or a global install.
