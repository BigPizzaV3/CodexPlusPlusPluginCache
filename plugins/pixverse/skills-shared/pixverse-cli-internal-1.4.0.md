# PixVerse internal CLI 1.4.0 reviewed delta

This local-plugin addendum records the manually reviewed internal build `1.4.0-internal.20260904-151209`. Its `dist/capabilities.json` uses schema `1.2.0`, contains 93 command records, and has SHA-256 `dfa8c5ee63e87c47d0af623262e6099ce2863bce3a9a98fa8e6e0c4cc96d833e`.

The public compatibility floor is now `pixverse@1.4.0`; use `pixverse-cli-1.4.0.md` for guarantees shared by the online and local channels. This addendum records local artifact identity and Canvas adapter details whose serialized representation can differ from the npm package.

The Wrapper normalizes reviewed representation-only differences before validation. In particular,
public `create reference` duration metadata may encode automatic duration as numeric `0`, while this
artifact uses the literal string `auto`; both become the same string-based Wrapper contract.

## Capability discovery

- `pixverse capabilities --json` and `pixverse capabilities create [mode] --model <id> --json` read the bundled Create contract offline. They require no login and make no network request.
- Schema `1.2.0` adds `capability_domains.create` with normalized model/mode parameters.
- `bindings.canvas_cli` remains an offline discovery declaration. The canonical Canvas-to-Create mapping now comes from each live node's `capability_adapter` record rather than that static list.
- Canvas runtime discovery moved to `pixverse capabilities canvas --json`; use `--raw` only to inspect the unmodified service response. This command is live and authenticated. Targeted fallback remains `pixverse canvas node schema --node-type <type> --json`. The adapter revision is `canvas_cli_capability_adapter.v2` and the 17 runnable Canvas command contracts are otherwise unchanged.
- `pixverse capabilities canvas` supports `--node-type`, `--selector`, `--model`, `--raw`, and `--refresh`. Reuse one merged response and query a node schema only when the needed contract is missing or structurally incomplete.
- The merged CLI response uses `nodes[]`: `nodes[].canvas` is the source Graph contract, while
  `nodes[].routes[].cli.capability` is the resolved Create command contract. The Wrapper accepts the
  older `node_types[]` envelope only for compatibility and never treats a Create target type as proof
  of a Canvas source-payload type.

The preview runtime publishes `canvas_cli_capability_adapter.v2` selector routes and field mappings for
generation nodes. The plugin Wrapper uses them as the canonical contract and keeps a narrow legacy-input
shim only for reviewed aliases: `reference` → `reference_to_video`, `resolution` → `quality`, boolean
`audio=false/true` → numeric `0/1`, provider-path materialization for image/video/audio references, and
legacy `image` → canonical `image_to_video.customer_img_path`. Paid preflight rejects malformed legacy
graph nodes before account lookup. The adapter does not map `create_count`, `count`, or `n`, so one
Canvas generation node means one output.

The reviewed selector set is `text_to_image` / `image_to_image`, `text_to_video` /
`image_to_video` / `reference_to_video`, and `text_to_music` / `text_to_speech`. Paid preflight now
checks the selector-specific mapped values against the bundled offline `image`, `video`, `reference`,
`music`, and `voice` Create contracts. Image-to-image requires concrete provider-backed image paths;
speech requires a preset or provider voice ID; music follows the model's lyrics/instrumental/auto-lyrics
rule. The current music adapter does not map `duration_seconds`, so manual duration is not accepted by
the Canvas wrapper. `text_generate` is payload-schema-only and intentionally does not require an adapter.

Ordinary Create uses the CLI's boolean `--audio` / `--no-audio` flags. Persisted Canvas
`video_generate` payloads use the verified numeric `audio=1/0` switch until the runtime capability
publishes a Canvas source-payload schema or an explicit type transform.
Do not copy ordinary Create defaults into Canvas nodes merely because both surfaces mention the same
model.

## Create contract updates

- `create reference` now requires a non-empty `--prompt`, including audio-only Wan requests.
- `flux-3.0` is available for text/image-to-video only: 5–20 seconds, 720p/1080p, the declared aspect set including `2:1`, generated audio supported, and no multi-shot or off-peak mode.
- `wan-3.0` is available for video, reference, and two-frame transition: 2–30 seconds, 480p/720p/1080p, generated audio supported, and no off-peak mode. Reference accepts up to 10 images, 5 videos, 5 audios, and 20 items total; audio-only reference input is allowed. Wan transition requires a prompt.
- These are supported choices, not new automatic plugin defaults. Respect an explicit user choice and validate it from the offline capability domain; otherwise keep the existing membership-aware routing policy.

## Region

The CLI adds global `--region <global|cn>` with default `global`; `PIXVERSE_REGION` overrides the
flag. The Wrapper recognizes the option before or after the command so it cannot bypass paid-command
classification. Canvas bindings persist their region. For a guarded Canvas workflow, set one
`PIXVERSE_REGION` for project creation, graph reads, preflight, submission, and recovery; do not mix
regions or add a one-off `--region` to a Canvas subcommand. A legacy binding without a region is
treated as `global`.

## Seedance 2.5

`seedance-2.5` is available for `create video`, `create reference`, and two-frame `create transition`.

| Capability | Reviewed contract |
|---|---|
| duration | 4–30 seconds; reference also accepts `auto` |
| quality | 480p, 720p, 1080p |
| video/reference aspect | `auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` |
| reference images | up to 30 |
| reference videos | up to 10 |
| reference audios | up to 10 |
| all reference media | up to 50 total |
| reference task type | `auto`, `reference`, `edit`, `extend` |
| CLI audio toggle | unavailable; this does not establish whether native sound is generated |
| generated multi-shot | unsupported |
| off-peak | unsupported |

Plugin defaults follow `./quality-policy.md`: Seedance 2.5 at 1080p for supported video modes,
with `../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` before prompt/preflight. Its expanded
duration/reference domain also covers ordinary 4–15 second shots. If this runtime lacks the
model, refresh setup instead of silently reverting. Do not attach `--audio`, `--no-audio`,
`--multi-shot`, or `--off-peak`. Preserve requested sound in the prompt; separate sound production
is a creative or repair choice, and ordinary generation adds no automatic audio QA. Remove the
audio track during local export when a guaranteed silent deliverable is required.

## MiniApps boundary

The CLI adds `pixverse miniapps list`, `pixverse miniapps info`, and paid `pixverse miniapps create`. The first two are safe read-only inspection commands. The plugin intentionally does not queue `miniapps create` yet because its `project_id` submission, polling, download, billing, retry, and receipt semantics are not represented by the current `pixverse create <kind>` queue contract. Do not bypass preflight by invoking it directly; add a dedicated paid wrapper before exposing MiniApps generation.
