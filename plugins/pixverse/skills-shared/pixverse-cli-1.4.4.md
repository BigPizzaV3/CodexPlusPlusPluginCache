# PixVerse CLI 1.4.4 Capability Review

Historical model review; the current CLI delta is in `./pixverse-cli-1.4.5.md`.

Reviewed on 2026-09-16 against the CLI source at commit `2275f40`, the published npm
package, and the plugin-managed runtime. Their parsed capability manifests agree.
The plugin version at that review was `1.3.0`; the shared minimum stays `pixverse>=1.4.0` with
Node.js `>=22.12.0`. Newer model choices require the active channel to expose them.

## Published Identity

- Package: [pixverse 1.4.4](https://www.npmjs.com/package/pixverse/v/1.4.4)
- Capability schema: `1.2.0`; 93 command records
- Capabilities SHA-256: `6461782229562ff2c429c4866665f0bb77a45f951ced0e27a7cb3cba1f811510`
- npm integrity: `sha512-XKvkK6jkwIz1MSgKcnn+GFqowIC2dD/XMjI5S1bUIUKLZc7j/JBt9B7uHSLNtEnNsVC1TUdFANToLWS+6HMDnA==`

The 1.4.3 → 1.4.4 delta adds MiniMax H3 Max to the video model catalog and
`video`, `reference`, and two-frame `transition` contracts. Reference help adds
the new model name. Command names, options, image/audio contracts, Canvas bindings
and discovery, global region options, exit codes and transport remain unchanged.

## MiniMax H3 Max

Use this route for an explicit H3 Max request. It does not replace the plugin's
Seedance 2.5 1080p video default or Sunburst 2K/high image default.

| Property | Contract |
|---|---|
| Model id | `minimax-h3-max` |
| Modes | `create video` (text/image), `create reference`, two-frame `create transition` |
| Quality | `480p`, `768p`, `1080p`; CLI default `768p` |
| Duration | integer 5–15 seconds; default 5; no `auto` duration |
| Fixed ratios | `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` |
| Text-to-video framing | fixed ratios only; default `16:9`; `auto` is invalid |
| Image-to-video framing | always `auto`; use reference mode for a requested fixed ratio |
| Reference framing | `auto` or fixed ratios; default `auto`, also with video-only input |
| Transition framing | derived from the two images; no `--aspect-ratio` option |
| References | ≤9 images, ≤3 videos, ≤3 audios, **≤12 total** |
| Audio references | require at least one image or video |
| Prompt | required in all three supported modes |
| Unsupported | generated audio, multi-shot, off-peak, native extend/modify/motion-control, 3+ frame transitions |

Audio input is a reference role, not a promise of generated sound. Omit audio
toggles, `--multi-shot`, `--off-peak`, and Seedance-only `--task-type`. Do not invent
H3 Max-specific input duration, size or format limits: the CLI publishes count
limits and applies shared upload rules; remaining validation is backend-owned.
The older `minimax-h3` has different quality choices (`768p`, `1440p`, default
`1440p`) and no published combined reference-count cap; do not interchange them.

Read the installed offline contract before authoring the selected mode:

```bash
"${PVX}" pixverse capabilities create reference --model minimax-h3-max --json
```

Examples are queue-task fragments. Preserve an explicit user quality; otherwise
1080p is a suitable plugin delivery choice for an explicitly selected H3 Max route.

```bash
pixverse create video --model minimax-h3-max --quality 1080p --duration 8 --aspect-ratio 16:9 --prompt "A slow tracking shot through a rain-lit street"
pixverse create video --model minimax-h3-max --quality 1080p --duration 8 --image ./opening.png --prompt "Continue the subject's movement from this frame"
pixverse create reference --model minimax-h3-max --quality 1080p --duration 10 --aspect-ratio 9:16 --images ./subject.png --videos ./motion.mp4 --audios ./voice.wav --prompt "@image1 follows the movement of @video1, guided by @audio1"
pixverse create transition --model minimax-h3-max --quality 1080p --duration 8 --images ./first.png ./last.png --prompt "Move smoothly between these two compositions"
```

Pass the fragment to `queue write` / `queue append`, preflight, and follow the
existing confirmation policy. Catalog presence does not prove account entitlement.

## Image Changes Retained From 1.4.1–1.4.3

`gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` accept `1080p`, `1440p`, `2160p`,
up to 16 image references, and `low`, `medium`, `high`, `xhigh`, `max` detail.
Their ten ratios are `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`,
`1:2`, `21:9` at every quality. CLI defaults are Flare, 1080p, low detail, 16:9;
the plugin explicitly selects Sunburst, 1440p, high detail. GPT Image 2.0 retains
only low/medium/high detail. See `./quality-policy.md` for creative defaults.

## Earlier Capabilities Rechecked

The complete 1.4.0 model/mode inventory is in `./pixverse-cli-1.4.0.md`; add the
two GPT Image 2.5 models and H3 Max above for the full 1.4.4 catalog. The following
choices already existed at the floor and were missing from earlier skill summaries:

- `minimax-h3`: video, reference, and two-frame transition, 5–15s, 768p/1440p.
- `kling-o3-4k`: video, reference, two-frame transition; `kling-3.0-4k`: video and
  two-frame transition. Select the 4K model id; **omit `--quality` for Kling video**.
- `grok-imagine-1.5`: image-to-video also accepts 1080p; an opening image is required.
- Seedream image models: `seedream-5.0-pro` (1080p/1440p, ≤10 references),
  `seedream-5.0-lite` (1440p/1800p/2160p, ≤6), `seedream-4.5` (1440p/2160p, ≤6),
  `seedream-4.0` (1080p/1440p/2160p, ≤6). They do not accept GPT detail flags.
- `music-3.0` and `music-v2`: lyrics, auto lyrics or instrumental. `music-2.6` remains the
  default. The CLI lists `--duration-seconds`, but the service rejects fixed targets
  (400017), so the queue refuses it and audio is trimmed locally. Lyria also accepts up to
  10 image references, but no separate `--lyrics`. See `./audio-craft.md`.

## Channel And Surface Boundaries

A global npm upgrade does not update the plugin runtime. On the online channel,
refresh it with `"${PVX}" bootstrap --yes`. Local builds use their embedded internal
ZIP; this public review does not certify a new internal artifact. If the active
channel lacks a requested model, stop and repair that channel rather than downgrade.

Canvas must advertise the model in its live `capabilities canvas` adapter before
use. Offline Create support alone does not authorize a Canvas route. Keep bound
preflight, region, approval, cloud preview and on-demand delivery rules intact.

The queue recognizes all 11 Create command modes. For `create template`, inspect
`template info` first: the current queue polls template output as video. Image
templates need dedicated output-type/receipt handling before using that queue;
do not promise their generation or substitute an ordinary image without agreement.
Read-only MiniApps discovery remains supported; paid `miniapps create` and MiniApp project delivery
are outside that queue until dedicated preflight/receipt/recovery support exists.
This is an explicit wrapper boundary, not an absent CLI capability. CLI self-update
is replaced by managed bootstrap; destructive account/asset/config operations
remain explicit user actions.

Verification covers source, published metadata, offline contracts, queue validation
and tests. It does not claim paid generation or live Canvas model availability.
