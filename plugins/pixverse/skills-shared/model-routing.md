# Model Routing

Apply `./quality-policy.md` for every image/video workflow. These are plugin creative
choices; upstream capability defaults do not override them.

| Need | Default route |
|---|---|
| Any final still, draft, reference board, character/scene/product/UI plate | `gpt-image-2.5-sunburst --quality 1440p --detail-level high` (2K/high) |
| Text-only or opening-frame video, preview or final | `seedance-2.5 --quality 1080p` through `create video` |
| Identity/style/motion/audio reference or ordered independent keyframes | Seedance 2.5 `create reference`, 1080p |
| Strict first/last frames | Seedance 2.5 two-frame `create transition`, 1080p |
| Edit source video or its sound | Seedance 2.5 `create reference --task-type edit`, auto duration/framing |
| Continue source video | Seedance 2.5 `create reference --task-type extend`, auto framing |
| User accepts image fallback after the subscription choice | `gemini-3.1-flash-lite --quality 1080p`, no detail flag |
| User accepts video fallback after the subscription choice | `v6 --quality 540p`, only supported modes |
| Narration / BGM | `speech-2.8-hd` with an explicit voice / `music-2.6`, instrumental unless requested |

Always apply `../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` to Seedance 2.5 prompts
before preflight. Draft intent does not lower model, resolution or detail. Honor explicit
model/format/quality/reference choices; make any incompatible constraint visible before spend.

For animated faceless production, `pixverse-explainer` keeps this Seedance 2.5 1080p
default and submits its filled block template as the prompt; follow its
`../skills/pixverse-explainer/references/model-route.md`. Gemini Omni Flash is an
on-request alternative there.

## Capability Boundaries

Read offline `capabilities create <mode> --model <id> --json` for unfamiliar combinations.
The release capability matrices record supported alternatives, not creative defaults.
Never silently replace the preferred model because a managed CLI is out of date.

For an explicit alternate-model request, read `./pixverse-cli-1.4.4.md`. It covers
MiniMax H3 Max, GPT Image 2.5 choices, Kling 4K, Seedream and newer music models.
Automatic `route queue` uses the defaults above; an explicit model outside those
routes uses `queue write` with its offline capability contract. Do not substitute
a default merely because the route helper has no selector for the requested model.

Seedance 2.5 supports 4–30 second video/transition shots and reference auto duration where
exposed. Reference limits are up to 30 images, 10 videos, 10 audio inputs, 50 total; inspect
current input duration limits too. Reference mode requires a prompt and a visual source when
using audio. It has no CLI audio, multi-shot or off-peak flag; sound and intended cuts belong
in the enhanced prompt. Guaranteed silent delivery needs audio removal at export.

Native `create extend`, `create modify` and `create motion-control` have different model
contracts; prefer Seedance's reference task for compatible creative needs. If the user asks
for a specific native operation, verify its model rather than attaching Seedance to an
unsupported command. Three or more strict transition images require the native multi-frame
model; independent semantic keyframes can use Seedance reference. Do not confuse the two.

For 3:2/2:3 or under-four-second video, explain Seedance's capability wall. A compatible
v6 route or an agreed delivery adaptation requires an explicit choice and fresh preflight.
Never discard identity references or change the story silently to fit a fallback.

## Account Choice

Use `--membership-tier auto`. Free/Basic stops before generation and shows the clickable
subscription link; any paid-tier model-entitlement rejection stops subsequent submissions.
Follow `./quality-policy.md`: wait for upgrade and recheck the premium batch, or compose
v6 540p / Nano Banana 2 Lite 1080p only after explicit fallback consent. Unknown login,
membership or balance cannot spend. Quote skips do not waive this choice.

## Production Shape

A simple prompt remains one requested-medium task. Add paid control assets only when
explicitly justified by identity, composition or continuity and included in the confirmation.
Keep references in the chain; use per-shot frames when compositions differ. Do not reduce
control-image quality automatically. Other image families and older video models remain
available for explicit user choices, with their own capability-checked parameters.

Deliver ordinary images/clips directly after generation and download. Media QA remains
opt-in or specialized-workflow-required. Canvas uses its live adapter and cloud delivery
contract; never copy Create parameters blindly into graph nodes.
