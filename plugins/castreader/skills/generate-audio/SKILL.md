---
name: generate-audio
description: Generate playable MP3 or WAV files from text with CastReader, report estimated and actual API charges, and resume interrupted audio jobs without duplicate generation. Use when the user wants audio output or recovery of a CastReader job.
---

# Generate and recover audio

Use Node.js 22+ and `<plugin-root>/scripts/voice.mjs`, two directories above this skill. The output folder contains private input and job state; keep it outside source control. `CASTREADER_API_KEY` belongs in the environment, never in chat, URLs or CLI flags.

## Generate

1. Write UTF-8 `input.json` with the user's `text`, explicit spoken `language`, optional `voice_id` and `output_format` (`mp3` default, or `wav`). Default voice selection uses the account's ready narrator. Do not invent voice IDs. Inspect ready voices with `node <plugin-root>/scripts/voice.mjs voices`.
2. Read current capabilities using `node <plugin-root>/scripts/voice.mjs capabilities`. Current per-job limit: 500 normalized Unicode code points. For longer text, create serial chunk plans with stable folders and a total budget; do not silently omit or summarize. Do not offer realtime or streaming when disabled.
3. Use the user's budget. For a short audio request without a budget, disclose the live estimate and use a conservative $0.01 per-clip ceiling; a request to generate already authorizes ordinary generation within that ceiling. Ask only when a stated limit is exceeded or a materially larger task needs a larger budget.

```sh
node <plugin-root>/scripts/voice.mjs plan --input /absolute/input.json --output /absolute/audio-run --max-usd 0.01
node <plugin-root>/scripts/voice.mjs run --output /absolute/audio-run --wait-ms 45000
```

`plan` routes, checks voices and estimates without synthesis. Its maximum is a current price/balance estimate, not a reserved quote. `run` rechecks before submission. Report the estimate before generating. API trial/wallet are separate from App Pro. Never top up, buy or change subscriptions.

4. Verify successful files with an available audio inspector such as `ffprobe`, and render the absolute local path: `![Generated audio](/absolute/audio-run/audio.mp3)`. Include actual `chargedUSD` and trial characters. `receipt.json` records bytes and SHA-256; private `state.json` preserves recovery identity. File validation does not prove pronunciation quality.

## Resume

```sh
node <plugin-root>/scripts/voice.mjs resume --output /absolute/audio-run --wait-ms 45000
```

For `pending`, retain the folder and resume after the suggested delay. Uncertain submissions reuse the original body and idempotency key. Known jobs are only polled. Verified local files are reused without API calls; missing or damaged bytes are redownloaded from the same job. Respect Retry-After. Do not switch regions, keys, voices or input to force a retry.

For `failed`, `cancelled` or `expired`, report status and charge. Deliberate new generation needs a new plan within the user's authorization. For `output_locked`, inspect the PID in `.lock`; remove the lock only after verifying the earlier process is gone. Keep `state.json` intact; never reset it to resolve an error.

English alignment is optional (`return_timestamps: true`) and can be unavailable even when audio succeeds. Keep segment-relative times and processed text; never invent timestamps or claim other-language alignment. Successful audio remains billable without alignment.

Without a configured key, preserve the requested input and link to `https://voice.castreader.com/console` for setup. Never borrow another account's credentials or claim a prerecorded demo was freshly generated.
