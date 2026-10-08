---
name: pixverse-agent-quality
description: Inspect PixVerse media when the user requests QA or a specialized workflow explicitly requires specific quality checks. Supports diagnosis of failed or weak outputs. Ordinary image/video generation delivers without invoking this skill.
---

# Quality

Activate only for requested QA or named checks required by a specialized workflow.
Ordinary image/video generation has no automatic QA stage; missing QA is not unfinished
delivery. When activated, read `../../skills-shared/quality-rubric.md` and use only the
checks needed for the request.

## Canvas Scope

When the user explicitly selects a Canvas project/node, use the Canvas skill's
**Cloud Preview And On-Demand Delivery** contract in `../pixverse-agent-canvas/SKILL.md`.
Review the Canvas preview and existing output metadata; do not download media, run `qa project`,
recover queue ledgers, or query credits automatically. Missing local files are not a cloud delivery
failure. Report unverified resolution, duration, audio, and other technical properties as
`not_checked` (not checked); never claim full technical QA from requested params or a success status.
An unavailable browser means visual review is unperformed, not failed generation.

The local-file requirements, commands, and invoice recap below apply to non-Canvas production.
For an explicit Canvas file/export or local-inspection request, download only the needed assets and
use targeted `qa inspect <local-file>` checks, not queue-only `qa project` recovery. That request does
not also authorize credit reporting. Keep the creative checks and paid-retry guards for both routes.

## Checks For The Requested QA Scope

Check:

- every generated asset exists as a local file; a reachable provider URL alone is not sufficient for Codex delivery
- media type, aspect ratio, and duration match the promise
- references and identity anchors survived
- product/logo/UI/text constraints are acceptable
- audio exists if promised
- no obvious failure, black frames, unusable crop, or fake text problem
- the output matches the user's intended aesthetic, including deliberate roughness, historical style, bad composition, phone-native capture, or other non-polished targets
- no fallback silently dropped a required reference, plate, subject, or control mode

Treat QA as a cost-control gate. Pass usable outputs that broadly meet the brief. Do not regenerate for subjective improvements, minor artifacts, small fake text, or "could be better" taste issues unless the user approves another paid attempt after seeing a fresh generation confirmation.

## Commands

```bash
"${PVX}" qa project <slug>
"${PVX}" qa inspect <file-or-url> --project <slug>
"${PVX}" qa inspect <local-video> --project <slug> --sample-frames
"${PVX}" qa inspect <video> --project <slug> --expect-audio
"${PVX}" qa inspect <video> --project <slug> --expect-no-audio
"${PVX}" qa inspect <video> --project <slug> --expect-duration <seconds> --expect-aspect-ratio <ratio>
"${PVX}" project ledger <slug> --format markdown
pixverse asset info <id> --type video --json
pixverse asset download <id> --type video --dest ./projects/<slug>/assets/videos
```

When whole-project QA is requested, use `qa project <slug>` as the aggregate inspection path. It reads the latest run, applies duration/aspect/audio expectations from its quote, inspects every available asset, persists one aggregate report, and returns the asset plus invoice ledger in one host-tool call. Use individual `qa inspect` calls only for a specific asset, deeper local frame sampling, or a targeted diagnosis.

`qa project` uses `local_path`, not the provider URL. For an old ledger or a transient preview-download failure, it first retries the free asset download by task id and then inspects that local file. If localization still fails, report `local_asset_unavailable`; do not treat the remote URL as equivalent QA evidence and do not regenerate.

For final delivery after multiple batches, use one whole-project pass:

```bash
"${PVX}" qa project <slug> --all-runs
```

It deduplicates idempotent billing records and keeps duration, aspect, and audio expectations attached to the run that produced each asset.

## Retry Logic

- Retry concurrency and network failures after waiting.
- Rewrite prompt/moderation failures when the creative intent can be preserved. Re-preflight
  bounded repairs and follow the effective generation confirmation policy; only `require`
  waits for explicit approval. Do not resubmit unresolved tasks.
- Fix invalid parameters directly.
- For subject drift, switch to image/reference mode or stronger anchors.
- For logo/text problems, create a locked still plate first.
- Regenerate only for hard failures or hard user-constraint misses. Otherwise disclose the limitation and keep the usable asset.
- If a failed, rejected, or weak asset influenced the final choice, include its local path when available plus provider URL and task id in the final recap.

## Final Recap Shape

Show the primary asset first. Then one short paragraph:

- what was produced
- what you checked
- any limitation or next recommended iteration
- any failed or weak assets that should remain visible to the user

Then include a compact "Generated Assets" ledger whenever the run generated or used multiple assets. List role, task id, model/major params, status, absolute local path, and provider URL for each final/reference/failed asset. Render selected images/videos from the local path. Do this even if those assets appeared in progress updates, because final answers may be read without the intermediate transcript.

Use `queue run` output first when it is still in context. If returning to a project later, run `"${PVX}" project ledger <slug> --format markdown` and adapt that ledger into the final recap with QA judgment.

Keep deep technical trace in project memory unless the user asks.
