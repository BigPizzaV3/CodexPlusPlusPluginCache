---
name: pixverse-delivery
description: "Video delivery: recover PixVerse results, download existing assets, continue a project or package final files. Run media QA when explicitly requested."
---

# PixVerse Delivery

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Use this to recover, inspect or export an existing project. Ordinary image/video generation completes directly in its creation workflow; it does not need this skill or QA. In this skill, load quality playbooks and perform inspection only when the user requests QA or a specialized workflow explicitly requires named checks. Editing requests enter `../pixverse-video-editing/SKILL.md` directly; production workflows own their final handoff.

Before any new paid generation or retry, follow `../../skills-shared/cli-workflow.md`.

For an explicitly selected Canvas target, use `../pixverse-canvas/SKILL.md` as the direct entry. If its
internal Canvas playbook is already loaded, continue under it without restarting the handoff or
loading ordinary local-delivery playbooks merely because this entry was also selected.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Internal Playbooks

- project memory, preferences, useful decisions, asset mapping, rejections: `../../skills-internal/pixverse-agent-project-memory/SKILL.md`
- QA, inspection, retry logic, final delivery checks: `../../skills-internal/pixverse-agent-quality/SKILL.md`
- stitching, subtitles, BGM, narration overlay, trimming, packaging: `../pixverse-video-editing/SKILL.md`
- asset info, task ids, downloads, CLI syntax: `../../skills-internal/pixverse-agent-gateway/SKILL.md`
- Canvas-native editing, graph reuse, composition, compression, and guarded mutation: `../../skills-internal/pixverse-agent-canvas/SKILL.md`

## Canvas Delivery Routing

Apply this routing only when Canvas has been selected as the current target under the Canvas
playbook's activation boundary. Then prefer current executable capability-declared Canvas nodes such as
`video_compose`, reuse the existing graph assets, and avoid
download/edit/re-upload loops. Local finishing remains available for requirements the Canvas schema
cannot express, an explicitly requested local master, or final delivery-only packaging. If a local
fallback must return to Canvas, upload only its final result once.
`video_compress` is currently a reserved, non-executable, non-authorable compatibility type and must
not be constructed or dispatched.

For every non-Canvas source project or ordinary queue delivery, skip Canvas capability discovery and
retain the existing local preview, download, FFmpeg, subtitle, QA, assembly, and packaging workflow.
An unrelated or historical Canvas binding does not change that route.

For the explicit Canvas target, follow the Canvas skill's **Cloud Preview And On-Demand Delivery**
contract throughout delivery and recovery. Preview in Canvas; do not automatically download even
intermediate assets, run local QA, refresh the balance, or assemble an invoice. Follow cloud status
and reuse node/asset references. Use `project resume [hint] --surface canvas --format markdown` and
`project handoff <slug> --surface canvas --format markdown`, not queue-only `qa project` or ledger
recovery. Report stage, cloud nodes, remaining work, and unverified technical properties. If IAB is
unavailable, return the Canvas link without silently downloading or claiming visual QA passed.

Automatic Canvas review also follows **Preserve The User's Viewing State** in that playbook: no
enlarged dialogs, zoom, fullscreen, or maximization without the user's explicit enlargement request.
Preserve an already enlarged user view; failed controls leave checks unperformed, not permission to
change the viewing mode.

An explicit request for local files enables only the required export/download and targeted file QA;
credit reporting remains a separate opt-in. Record a completed file handoff with
`--delivery-mode local --deliverable-path <actual-file>`; cloud completion does not need local media.

## Ordinary Queue And Local Production Delivery Contract

The remaining queue/ledger workflow is for non-Canvas production. For requested Canvas file delivery,
apply only its relevant local file checks; keep the Canvas follow/recovery contract above.

`queue run` downloads every successful generated asset under `projects/<slug>/assets/` and returns an absolute `local_path`. As soon as that path exists, show the primary image/video from the local file using the host's local-media syntax. Do not use the provider URL as the Codex inline preview source; it remains useful only for audit or external sharing. Do not hold the local preview behind deep QA, billing reconciliation, ledger recovery, packaging, or analysis. Use the returned result for ordinary delivery; only perform QA afterward when requested or explicitly required by a specialized workflow.

If `local_preview_status` is not `ready`, say that generation succeeded but local delivery failed. Retry the free `pixverse asset download` path by task id; do not regenerate and do not fall back to a remote URL for Codex display.

When continuing an existing project, read memory before acting:

```bash
"${PVX}" project resume [title-or-slug-hint] --format markdown
"${PVX}" project portfolio --format markdown
"${PVX}" project search <slug> "<asset, task id, style, rejection, or cue>"
"${PVX}" project ledger <slug> --format markdown
```

Use `project resume` first for “continue”, “the earlier one”, or a fuzzy title. It returns the likely project, stage, compact memory, latest assets, unresolved work, and one recommended next action without dumping provider payloads. Use `project portfolio` when multiple projects may match; reserve `project summary` for deep raw trace inspection.

When QA is requested or a specialized workflow explicitly requires inspection, verify the relevant items:

- promised generated assets exist as local files; a provider URL alone is not a completed Codex delivery
- media type, aspect ratio, duration, and audio match the brief
- product, character, UI, or text constraints survived well enough
- the result obeys the user's intended aesthetic, including deliberate roughness, historical texture, or imperfect capture
- no required reference, product plate, storyboard frame, or control mode was silently dropped
- project memory records useful task ids, absolute local preview paths, provider URLs, and creative decisions
- `project ledger <slug> --format markdown` or `queue run` output gives the final invoice-style asset ledger
- retry recommendations are cost-aware and explicit

For local inspection:

```bash
"${PVX}" qa project <slug>
"${PVX}" qa inspect <file-or-url> --project <slug>
"${PVX}" qa inspect <video> --project <slug> --expect-duration <seconds> --expect-aspect-ratio <ratio>
```

When project QA is requested, prefer `qa project <slug>` for the latest completed run so technical checks, the generated-asset ledger, and the invoice are recovered together instead of one asset per host-tool call.
When whole-project QA is requested after several generation batches, use `qa project <slug> --all-runs` to inspect every unique historical asset in one call; idempotent reruns are deduplicated while each asset keeps the expectations from its own quote.

For a non-Canvas story queue made of `shot-01`, `shot-02`, and later shots, close the local post-production loop in one call:

```bash
"${PVX}" story assemble <slug> --output projects/<slug>/deliverables/final-story.mp4 --sample-frames
```

It reads ordered story assets from the latest ledger, reuses local downloads or downloads missing clips by task id, stitches them through FFmpeg, checks the combined duration, runs technical QA, samples the full timeline when requested, and records the deliverable in project memory. Pass ordered `--asset-id` values for an older run or explicit ordered `--clip` paths for a custom cut.

For subtitles and narration, use actual audio as the clock and an aligned SRT/ASS for rendering. Follow `../pixverse-captions/SKILL.md`; a caption-only edit does not regenerate voice. Use `../pixverse-voiceover/SKILL.md` and the segmented voice-queue helper below only for an explicit fixed-window take plan. Preserve spoken text and honor the requested display typography:

```bash
"${PVX}" subtitles clean projects/<slug>/prompts/narration.srt projects/<slug>/prompts/narration.clean.srt
"${PVX}" subtitles inspect projects/<slug>/prompts/narration.clean.srt
"${PVX}" subtitles style --format force-style
"${PVX}" subtitles voice-queue projects/<slug>/prompts/narration.clean.srt projects/<slug>/voice-queue.json --project <slug> --segments-dir projects/<slug>/prompts/tts-segments --voice-id <voice_id> --language zh --speed 0.9
```

Do not end displayed subtitle lines with sentence punctuation unless the user explicitly asks for that typography.

Keep generated media, manifests, quality reports, and notes under `projects/<slug>/`.

At the end of every meaningful stage—not only final delivery—show the project handoff:

```bash
"${PVX}" project handoff <slug> --stage <planning|character-lock|storyboard|control-assets|preview|render|final> --format markdown
```

This makes editable plans, prompts, queues, project memory, QA/audit files, generated media, and deliverables visible instead of hiding project management inside the plugin.
