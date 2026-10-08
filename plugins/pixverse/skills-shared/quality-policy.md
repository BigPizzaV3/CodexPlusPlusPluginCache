# Image And Video Quality Policy

Apply to every public workflow, ordinary queue, generated control asset, and new Canvas
generation node. Respect explicit user choices and existing approved assets. Version 1.3.2
keeps these plugin defaults separate from upstream CLI defaults.

| Output | Default model | Resolution | Rendering detail |
|---|---|---|---|
| Images, drafts, boards, references, realism refinements, image edits, mockups and final stills | GPT Image 2.5 Sunburst (`gpt-image-2.5-sunburst`) | 2K (`--quality 1440p`) | `--detail-level high` |
| Video, previews and final shots | Seedance 2.5 (`seedance-2.5`) | `--quality 1080p` | enhance the prompt before preflight |
| Image fallback, only after the user's choice | Nano Banana 2 Lite (`gemini-3.1-flash-lite`) | `1080p` | no GPT detail flag |
| Video fallback, only after the user's choice | PixVerse `v6` | `540p` | keep the creative brief and supported references |

The animated faceless workflow uses these same defaults; its
`../skills/pixverse-explainer/references/model-route.md` records block costs and the
on-request Gemini Omni Flash alternative.

Draft intent changes planning depth, not these quality defaults. Use older models, other
image families, lower quality, or a paid upscale only when explicitly requested or after
explaining a concrete capability limitation. Simple video requests remain one video task.

Named specialized workflows may require a distinct processing stage, such as the UGC
board realism refinement specified in `./ugc-production.md`. Preserve that stage using
the same Sunburst 2K/high image default, with the accepted image as its edit reference.
Image editing is not an exception to the default model. Include each required generation
or edit task in preflight; keep the matching aspect and protected content. Explicit user
choices and the membership fallback contract below still take precedence.

Before writing a Seedance 2.5 prompt, apply
`../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` automatically. Enhance locally as the
agent; no extra generation, remote enhancer, new runtime, or user approval for the rewrite.
Preserve explicit verbatim prompts. Final prompts and parameters must be present before
the generation confirmation. A later rewrite requires a fresh preflight.

## Membership: Stop, Explain, Then Follow The Choice

Resolve live authentication, membership and balance during preflight. Free/Basic accounts
**must stop before generation**, even with sufficient credits or a quote-confirmation skip.
Keep the premium plan ready. Paid accounts can also lack a particular model entitlement:
on `membership_route_required` / `membership_required`, stop new submissions, keep successful
assets and unresolved task IDs, and do not retry, rewrite the prompt, or auto-downgrade.

Show the actual selected model and account limitation. Include a clickable subscription
link in the response: use returned `subscription_url` / `subscription_link`, or obtain the
current environment's URL with `"${PVX}" pixverse subscribe`. Production is
[PixVerse subscription / recharge](https://app.pixverse.ai/subscribe).
For browser handoff follow `./web-handoff.md`; payment is completed by the user.

Ask once whether the user wants to upgrade for the planned quality or use the fallback.
For example: “This account cannot currently use these high-quality models. You can [recharge or upgrade PixVerse](https://app.pixverse.ai/subscribe)
and continue, or choose v6 540p / Nano Banana 2 Lite without upgrading. These models can still realize the idea,
with more limited detail, complex motion and consistency. Which option would you prefer?”
Localize and mention only relevant media. Do not promise that adding credits grants membership.

- **Upgrade:** wait for the user's completion, refresh live account/entitlement and balance,
  and preflight the original premium plan again. If preflight stopped before submission,
  reuse that queue. If a run recorded terminal failures, create a replacement queue with
  new task IDs for only the failed/unsubmitted work, keeping its premium model and prompt.
  An unchanged failed queue restores its failure; it is not a retry command. Reuse completed
  assets through their provider paths, recover unknown submissions by ID, and never regenerate
  completed assets. New paid attempts still follow the confirmation policy.
- **Declines upgrade / accepts fallback:** record `--accept-basic-fallback` on `route queue`
  or `story queue`. For manual `queue write` / `queue append`, specify the fallback models
  and parameters explicitly and pass that wrapper flag; JSON authors set the queue-level
  `"basic_fallback_accepted": true` only for an actual user choice. It records consent for
  this queue, never a global preference. Show a fresh generation confirmation.
  After a failed run, use a replacement queue and new task IDs as above; retain old receipts.
- **Canvas:** after the choice, prepare compatible nodes, preserve references, sync and use
  `canvas paid preflight ... --accept-basic-fallback`. Consent is bound to the returned plan.
  Run its exact command; never add the flag afterward or modify an approved graph silently.
- **No answer:** remain stopped. Stored paid-confirmation skips do not authorize model
  downgrade. A prior explicit choice for the same unchanged batch need not be requested again.

Fallbacks still require valid login, available credits, current capability support and the
existing paid approval policy. Check v6's duration/reference limits and Lite's 1080p/reference
limits before re-quoting. Do not drop extra references, truncate a shot, or change mode
silently. If the fallback is also rejected, stop and explain; do not descend through models.
Keep the explicitly authorized `unrestricted-test` account override and all other gates.

## CLI And Canvas Boundaries

Use offline `capabilities create <mode> --model <id> --json` for current CLI parameters.
New queue builders materialize the defaults. Hand-authored JSON must carry explicit model,
resolution and detail settings; saved queues and paid receipts are not rewritten on load.
Refresh an outdated CLI instead of silently reverting to old defaults.

Canvas uses its live capability adapter's selector routes and field mappings. Set the
same intended model/quality through those fields before preflight; do not copy CLI flags
or Create defaults into node payloads. Never mutate existing user nodes merely to refresh
plugin defaults. Canvas cloud preview and on-demand download/credits rules remain intact.
