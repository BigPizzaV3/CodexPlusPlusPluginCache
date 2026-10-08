# Quality Rubric

Apply this rubric only to user-requested QA or named checks required by a specialized workflow. Ordinary image/video generation delivers directly without invoking this rubric; missing QA does not make generation or delivery incomplete. Keep QA cost-aware: PixVerse generations are expensive, so QA should identify hard failures and material mismatches, not chase subjective perfection by default.

## Canvas Scope

For an explicitly selected Canvas project/node, the canonical policy is **Cloud Preview And
On-Demand Delivery** in `../skills-internal/pixverse-agent-canvas/SKILL.md`. Review the cloud preview
and existing output metadata, label unverified technical properties `not_checked`, and disclose
unperformed visual review. Do not automatically download, run local QA, restore queue ledgers, or
query post-generation balances. Cloud media need no local copy. Input parameters are not output QA
evidence. Explicit local delivery or local inspection enables the relevant file checks only;
credit reporting is a separate request.

The local-file/tool/invoice requirements below are for ordinary queues and local production; use
targeted file checks only for requested Canvas exports. Creative constraints and paid-retry safety
apply to both. Canvas-native fixes take precedence for Canvas; the local repair examples below do
not override that route. Merely finding a Canvas binding in the directory does not activate it.

## Basic Checks

- Does every generated asset have a usable absolute local file path? A provider URL or task id alone is not sufficient for Codex delivery.
- Does the media type match the user request?
- Does aspect ratio match?
- Does duration roughly match?
- Did reference subjects survive?
- Are product/logo/text constraints acceptable enough for this brief?
- Is motion coherent enough for the stated use?
- Is there unwanted fake readable text that materially hurts the brief?
- Is the output too dark, cropped, blurry, or visually generic?
- Did audio exist when audio was promised?
- If synchronized SFX/ambience was promised, is there unwanted music, background score, rhythmic bed, or melodic audio?
- Are generated SFX and ambience pleasant enough to keep, or should that audio be rejected and rebuilt?

## Intent And Taste Checks

Ask these before declaring done:

- Did the output follow the user's explicit style, era, roughness, model, and negative constraints?
- Did the agent accidentally beautify a request that asked for amateur, shaky, low-budget, wrong, surveillance, documentary, or historical texture?
- Did the generation preserve the correct reference role: identity anchor, product plate, storyboard frame, style reference, motion reference, or audio reference?
- Did any fallback silently reduce control, such as reference mode to pure T2V, exact plate to invented text, or multi-subject control to a vague prompt?
- Is another paid attempt likely to materially improve the hard goal, or can local edit/post-production solve it cheaper?

## Use Tools

For local files:

```bash
"${PVX}" qa inspect <file> --project <slug> --sample-frames
"${PVX}" qa inspect <video> --project <slug> --expect-audio
"${PVX}" qa inspect <video> --project <slug> --expect-no-audio
"${PVX}" qa inspect <video> --project <slug> --expect-duration <seconds> --expect-aspect-ratio <ratio>
```

Video frame sampling must cover the timeline, not only the opening seconds. The helper seeks explicit, evenly spread timestamps from zero to just before EOF so short clips and 30-second or multi-clip films include their ending in visual QA.

For externally supplied URLs or targeted network diagnosis only:

```bash
"${PVX}" qa inspect <url> --project <slug>
```

With `--project`, QA writes both a target-specific report in `projects/<slug>/quality/` and a latest `qa-report.json`. Normal generated-asset QA uses `qa project`, which downloads any missing local asset by task id and inspects the local file instead of the provider URL.

For PixVerse task ids:

```bash
pixverse asset info <id> --type video --json
pixverse asset download <id> --type video --dest ./projects/<slug>/assets/videos
```

## Recovery

- Prompt rejected: rewrite safer, preserve the creative job.
- Hard failure: missing asset, unusable/black file, wrong media type, materially wrong aspect or duration, missing promised audio, rejected prompt, invalid parameter, auth, balance, or network failure.
- Hard failures can be retried or fixed only after the user-facing preflight confirmation rules are satisfied again for the new paid attempt.
- Soft issue: minor artifacting, imperfect motion, weak but usable composition, small fake text, slight style drift, or content that is acceptable but not ideal.
- Soft issues should be disclosed in the recap and included as candidate iteration notes; do not automatically regenerate.
- Content mismatch should trigger regeneration only when it violates a hard user constraint or makes the asset unusable for the stated purpose.
- If an asset fails or is weak enough to affect decisions, return it or link it in the final recap rather than hiding it.
- Bad audio/subtitle sync is a hard issue when subtitles were promised. Fix locally from the shared SRT source before considering another paid generation.
- Compare caption timing with actual audio. For explicitly fixed-window takes, verify each measured take fits its intended window without clipped speech; ordinary narration need not generate one voice asset per caption.
- Two-line, overly high, or oversized subtitles are a visual QA issue unless explicitly chosen. Normal 1080p horizontal subtitle burns should use the plugin default style (`Fontsize=18`, `MarginV=28`) rather than ad hoc large title-like text.
- Sentence-final punctuation at the end of displayed subtitle lines is a visual QA issue unless the user explicitly asked for that typography. Run `subtitles clean` and re-burn locally.
- Unwanted baked music is a hard issue when the sound plan asked for SFX/ambience without music.
- Bad generated SFX/ambience should be rejected for final film, trailer, commercial, or animation sound even if the picture is usable.
- If reference control failed, first repair the reference chain before dropping references.
- If the user requested deliberate imperfection and the result is too polished, treat that as a content mismatch.

## Final Recap Asset Ledger

Final user-facing recaps must make the generated process visible, even if the user saw progress updates earlier. Include a compact asset ledger whenever the run generated or used multiple assets.

Include:

- primary deliverable first, rendered inline when possible
- newly generated reference images, videos, audio, or music with role labels
- absolute local path plus provider URL for each asset
- PixVerse task id, model, and major params when known
- status: selected, reference, final, weak, failed, or unused
- any failed or weak assets that affected decisions
- invoice fields: actual charged credits from account usage when available, observed account credit delta for the run when captured, and any explicit price field only when PixVerse exposes it

Keep it compact. Do not paste long prompts unless the user asks.

Use `queue run` output fields `asset_ledger` and `invoice` as the first source for this recap, then add human judgment from QA. When resuming later, use `"${PVX}" project ledger <slug> --format markdown` to recover the latest stored billing ledger before writing the recap.

For PixVerse invoices, prefer `pixverse account usage --type used --limit <n> --json` as the settlement source: match usage `video_id` to result task ids and sum all matching credit rows. If exact per-task usage is not exposed or the account contains unrelated concurrent work, do not invent pricing. State the limitation, show the task-id-matched totals you can prove, and separately show any observed run-level credit delta from before/after account snapshots.
