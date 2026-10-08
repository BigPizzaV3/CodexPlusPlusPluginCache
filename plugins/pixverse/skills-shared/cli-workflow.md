# CLI Workflow Contract

Use this compact contract with the selected public workflow. Studio and Production
are not prerequisites. Resolve `PVX` from the installed skill's plugin root.

Read `./quality-policy.md` for every image/video route. Before Seedance 2.5 queue composition,
apply `../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` to the actual prompt.
Check the actual submitted text with [prompt budgets](./prompt-budgets.md), preserving
the selected recipe's complete shot plan when compacting repeated wording.

## Simple Image Or Video: Two Execution Calls

Use one direct requested-medium task for a simple, single-beat prompt. Never silently
add a paid image, storyboard or extra variant to a video request. Preserve explicit
model, aspect, duration, count and reference choices. Exact subject/product locks or
multiple scenes need the relevant production workflow and `./cli-workflow-details.md`.

If an explicit model is outside the automatic route helper's supported choices,
read `./model-routing.md` and the current `./pixverse-cli-1.4.5.md` review, inspect
that model's offline contract, and use `queue write`. The automatic defaults must
not replace a requested H3 Max, Kling 4K, Seedream or other supported model.

1. Prepare and preflight in one fail-fast host tool call:

   ```bash
   "${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind <image|video> --membership-tier auto --prompt "..." --preflight --format markdown
   ```

   Add `--intent draft` for a requested quick preview; use `--intent final` for a final
   still or high-fidelity result. Account-aware routing prepares Sunburst 2K/high or Seedance 2.5 1080p.
   Free/Basic pauses for the upgrade/fallback choice; it never silently downgrades. It already checks setup,
   login, membership and balance. Do not separately call setup status, doctor, account
   info, route recommend, model lists or capabilities for a supported default route.
   Add `--reference` for each supplied anchor; do not silently discard references.

2. Briefly state the planned work and continue automatically under the default policy.
   Keep model/parameters, prompt preview, queue path and balance in the preflight record;
   it is not an exact price estimate. Only effective `require` asks for batch approval.
   Before submitting, follow **Paid Work And Recovery** below. Then run one long-lived call:

   ```bash
   "${PVX}" queue run projects/<slug>/queue.json
   ```

   Keep the same command session alive while the CLI submits, groups status checks,
   downloads and reconciles credits. Do not run task status or ledger queries beside it.
   Yield/poll the host session at 20–30 seconds; give meaningful updates within 45 seconds.
   A slow submission remains in flight: never launch a duplicate request.

## Deliver Directly

Show each absolute `local_path` as soon as stderr says `Local preview ready` or the
final JSON returns it. Deliver ordinary images and single video clips from those local
files. Trust the generated result: do not load quality playbooks, open images for
inspection, sample frames, run `qa project` / `qa inspect`, or wait for a quality report
by default. Do not route through Delivery merely to finish an ordinary generation.

Use the returned result and ledger for a short recap. Generation success and file
delivery are not a claim that visual quality, exact resolution or audio was verified.
Do not invent checks or regenerate for speculative flaws. A reported generation or
download error still needs truthful handling. Credit reconciliation stays in the
running command; no extra QA/ledger query or handoff command is needed for this simple path.

This targets two execution calls, plus needed skill reads and host-session waits.
QA remains available when the user requests it or a specialized workflow explicitly
requires named checks. In that case read `../skills-internal/pixverse-agent-quality/SKILL.md`
and perform those checks only. For multi-stage production or a requested handoff,
batch `"${PVX}" project handoff <slug> --stage <stage-name> --format markdown` with the
relevant stage work; do not add a compulsory completion stage to simple generation.

## Paid Work And Recovery

Use [generation confirmation](./generation-confirmation.md) for automatic generation
and the optional per-batch confirmation preference.

- Preflight every paid batch, including first generation, later stages, retries, reworks
  and extra variants. Default effective policy is `skip`: give a brief progress update
  and continue. The user's request authorizes the agreed deliverable and bounded repairs;
  no previous generation or additional confirmation reply is required.
- If the user asks to confirm spending or control cost, record project `require` before
  the next submission. Only effective `require` waits for explicit batch approval and
  uses `queue run --confirmed`. Offer “Allow future generation” to restore automatic execution.
  Follow the effective policy, not raw global flags. A later global choice supersedes
  older project choices; a newer project choice applies within that project.
- `--run-if-allowed` may combine preflight/run under default or explicitly selected
  automatic execution. It preserves setup, balance and effective confirmation checks.
- On `authentication_required`, read `./web-handoff.md`, run
  `"${PVX}" pixverse auth login --json`, open the emitted URL in Codex IAB, then doctor.
- On `membership_route_required` / `membership_required`, do not retry or rewrite the
  prompt blindly. Stop, show the clickable subscription link and wait for upgrade or
  explicit fallback choice. Follow `./quality-policy.md`; then show a fresh preflight.
  Read `./web-handoff.md` before subscription or workspace browser handoff.
- Unknown submission results remain unresolved; recover by task ID, never resubmit
  blindly. If a requested download fails, retry the free download with `"${PVX}" pixverse asset download <task-id>
  --type <image|video> --dest <project-assets-dir>`; do not run QA or regenerate to repair delivery.

## Read More Only When Needed

- Explicit Canvas project/node: `../skills-internal/pixverse-agent-canvas/SKILL.md`
  governs bound approval and cloud preview. A directory binding alone does not select
  Canvas. Do not apply automatic queue downloads, local QA or credit reporting there.
- Multi-stage production, complex control, batches, custom models or uncertain routes:
  `./cli-workflow-details.md`, then the relevant expert references. For manual CLI
  commands or queue specs, read `../skills-internal/pixverse-agent-gateway/SKILL.md`.
- Continuation: `"${PVX}" project resume [hint] --format markdown` first. Use portfolio
  only for ambiguity. Read `../skills-internal/pixverse-agent-project-memory/SKILL.md`
  when decisions, references, preferences or rejections should carry forward.
- Generated media and project state belong under `projects/`. `route queue` already
  persists the queue and route intent; simple tasks need no separate project-init stage.
