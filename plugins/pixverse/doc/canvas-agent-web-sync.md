# Canvas Agent/Web Synchronization

## Goals

Let the agent use PixVerse CLI and the user use the Web Canvas editor on the same cloud project:

- Read user changes committed to the cloud before modifying nodes.
- Prevent silent overwrites from concurrent edits.
- Show CLI results in the Codex internal browser.
- Avoid unbounded polling, browser DOM scraping and resident local processes.
- Use the same safety chain for online and local plugins when CLI `1.4.0+` passes the reviewed offline Canvas contract.

## Architecture

The public entry is `skills/pixverse-canvas/SKILL.md`, selected directly with `$pixverse-canvas`, an explicit PixVerse Canvas request, a project link supplied as the operation target, or continuation of a selected Canvas project. It identifies and routes the workflow without loading Studio first. The sole full operating contract is `skills-internal/pixverse-agent-canvas/SKILL.md`. A workflow already routed through Studio can reuse that internal skill without rereading the public entry or initializing another browser. Ordinary queues, local editing, historical bindings and existing browser tabs alone do not change routing.

The cloud graph is authoritative, CLI is the read/write channel, and the Web editor is the visual workspace. Local storage contains only project bindings and the latest accepted semantic snapshot.

```text
Codex Agent
   |
   +-- pvx canvas sync ------------------+
   |                                     |
   +-- pixverse canvas ... -- CLI --------+-- PixVerse Canvas cloud graph
   |                                     |
   +-- canvas handoff -- internal browser-+
                                         |
User -------------------- Web editor ----+
```

Synchronization is a bounded checkpoint workflow, not `canvas watch`:

1. Read before the operation.
2. Compare with the accepted local snapshot.
3. Use cloud `edit_version` for atomic version validation.
4. Submit the mutation once.
5. Read once after success and verify the receipt.
6. Wait for the next instruction without further polling.

## ChatCut Reference And Tradeoffs

The design follows collaboration patterns visible in ChatCut's public Agent Plugin: operate on the same cloud project through a managed MCP, reread the relevant scope before mutation, and read and verify afterward. The browser displays the editor; persistent DOM polling does not prove synchronization. Asynchronous task polling is reserved for background jobs with defined terminal states and timeouts.

References:

- [ChatCut MCP configuration](https://github.com/ChatCut-Inc/agent-plugin/blob/main/codex/.mcp.json)
- [ChatCut Plugin Basics](https://github.com/ChatCut-Inc/agent-plugin/blob/main/codex/skills/chatcut-plugin-basics/SKILL.md)
- [ChatCut Verification](https://github.com/ChatCut-Inc/agent-plugin/blob/main/codex/skills/verification/SKILL.md)

ChatCut's server-side real-time collaboration implementation is not public; this design assumes no private protocol. PixVerse maps read-before/verify-after behavior to CLI graph checkpoints and uses Canvas `edit_version` for verifiable concurrency control.

## Project Binding And Browser Handoff

Bindings are stored at:

```text
projects/<slug>/.canvas-project.json
projects/.canvas-project.json          # repository fallback
```

Project-scoped Canvas commands on either managed CLI channel may omit `--project-id`. The wrapper:

1. Uses an explicit `--project-id` if supplied.
2. Otherwise uses the current project or repository binding.
3. Creates one empty project only when no binding exists.
4. Reads and saves `project_id`, then injects it into the original command.

The Web address is constructed locally rather than returned by CLI:

```text
https://app.pixverse.ai/canvas/project/{project_id}
```

Get a structured handoff with:

```bash
scripts/pvx canvas handoff
```

Codex reuses the same internal browser tab. After mutation, observe whether the page updated live; refresh at most once if needed. Browser state never replaces CLI graph readback or participates in conflict decisions.

Automatic preview and QA follow the Canvas Skill's **Preserve The User's Viewing State** rule: retain the current preview size, do not open enlarged image/video modals, double-click media, zoom the canvas or page, maximize, enter fullscreen or repeatedly reclaim focus. Requests to inspect or preview, and approval to generate, do not authorize enlargement. Change viewing mode only on an explicit enlargement request. Do not close, shrink or Escape out of a view the user already enlarged. The initial handoff still shows a normal browser panel; later inspection must not repeatedly reopen a panel the user hid. If inspection or refresh would interrupt the current view, stop preview interaction, return the Canvas link and available metadata, and mark uninspected properties `not_checked`. Do not escalate or download automatically.

The handoff's `preview_policy`, `presentation.visibility_scope=initial_handoff_only` and `refresh_policy` express these agent obligations; they do not claim the browser has disabled fullscreen.

## Checkpoint Synchronization

When the first stage needs node contracts and a checkpoint, prefer one call:

```bash
scripts/pvx canvas prepare --node-type image_generate --node-type video_generate --format markdown
```

It returns the IAB handoff, matched `capabilities canvas` node contracts, graph checkpoint and component timings in one host call. Do not query `canvas node schema` when capabilities already define the required fields. Query a specific schema only if the target contract is missing, unreadable, or still lacks necessary fields/constraints after consulting reviewed references, including a concrete validation gap.

`pixverse capabilities create [mode] --model <id> --json` is offline and unauthenticated; it performs no network request. `pixverse capabilities canvas --json` is a live authenticated Canvas contract. Do not interchange them. The merged envelope uses `nodes[]`: `nodes[].canvas` is the raw graph contract and `nodes[].routes[].cli.capability` is the resolved Create contract for that selector. The wrapper only reads legacy `node_types[]` for compatibility. Executable generation nodes follow runtime `capability_adapter.contract_revision=canvas_cli_capability_adapter.v2`, selector routes, field mappings and resolved Create contracts. Preview may omit top-level `capability_schema_revision`; the wrapper proceeds only when all target contracts are compatible and that missing envelope field is the sole issue. Other incompatibilities fail closed.

Select region with `PIXVERSE_REGION=global|cn`; the environment variable overrides `--region`. Bindings record region; legacy bindings resolve to `global`. Project creation, sync, paid preflight, submission and recovery must all use one region. Mismatches stop before network calls. Guarded Canvas commands reject one-off `--region` flags.

```bash
scripts/pvx canvas sync --format markdown
```

Sync reads the latest graph, compares it with the last accepted snapshot, reports changes and atomically saves the new snapshot:

```text
projects/<slug>/.canvas-sync-state.json
projects/.canvas-sync-state.json        # repository fallback
```

Automatic creation, sync and mutation on the same binding hold `.canvas-sync-state.json.lock` across the local create/read/compare/mutate/write critical section. Waiting beyond 30 seconds returns `canvas_sync_lock_timeout`. This prevents duplicate default projects and stale checkpoint writes by concurrent local agents. The OS releases the lock on process exit.

Before remote creation, fsync `status: creation_started`. Execute the original command only after reading a valid `project_id` and atomically saving `status: bound`. An absent binding file is the only state allowing automatic creation. Invalid JSON, permission errors, unknown status and failed final writes fail closed. Incomplete receipts, partial failures or persistence failures retain `creation_started/creation_unresolved`; the next call must not create another cloud project blindly.

An explicit `--project-id` first writes the binding under the same lock, then performs remote reads/mutations. The resolved binding path applies throughout reads, writes, checkpoints and ledger operations so nested/test scopes cannot fall back to repository files. An unwritable binding prevents network access. Explicit `canvas project create` uses the same durable intent; remote success with a failed binding write returns `canvas_project_binding_update_failed`. Repair the binding with the known ID instead of retrying creation. If a usable binding already existed, creation intent retains its original `project_id`; the old project remains usable after failure, but resolve the new creation before trying again. Only `schema_version: 1` bindings are accepted.

Temporary `--workspace-id` overrides are rejected. Graph pre-reads, billing snapshots, mutations and reconciliation must use the same verified active workspace. Select the workspace in CLI first, then rerun without the override.

The `pixverse.canvas_sync.v1` output includes:

- `baseline_edit_version`: last accepted version;
- `current_edit_version`: current cloud version;
- `semantic_changes_detected`: whether semantic changes exist;
- `changes.nodes.added/updated/deleted`: node changes;
- `changes.connections.added/updated/deleted`: connection changes;
- `snapshot_accepted`: whether the snapshot was saved;
- `state_path`: snapshot location.

Default comparisons include project name/description, node types, titles, text, prompts, model parameters, outputs, dependencies and connections. They ignore viewport/zoom, node position/width/height, dragging, creation/update timestamps and runtime trace/idempotency/agent-patch metadata.

For layout checks:

```bash
scripts/pvx canvas sync --include-layout --format markdown
```

Sync both reads and accepts current state. An `--include-layout` checkpoint preserves that comparison mode for subsequent mutation guards, avoiding false external-change detection from missing position/style. Read the diff before rebuilding a mutation against the snapshot.

Changing comparison mode returns `canvas_sync_layout_mode_change_requires_reset` and preserves the old checkpoint, preventing simultaneous title/prompt/node changes from being silently accepted. After confirming the switch, explicitly use `--reset-checkpoint` with the intended `--include-layout` selection.

Mutations require a checkpoint. Normal sync does not silently overwrite a corrupted or incompatible checkpoint. After reviewing the cloud graph and choosing to rebuild the baseline:

```bash
scripts/pvx canvas sync --reset-checkpoint --format markdown
```

## Mutation Guards

The contract-validated Canvas wrapper intercepts mutation commands automatically.

### Composition Parameters And Optional Dry Runs

The field table, units, source references and complete `video_compose` example live in [Canvas composition parameters](../skills-shared/canvas-video-compose.md), loaded only for composition. CLI 1.4.0's offline registry declares Canvas `source: runtime`; discovery returns adapter-v2 mappings and may include nested payload schemas for composition and other nodes.

The wrapper follows the runtime target contract with narrow legacy patch compatibility: `gen_type=reference` becomes `reference_to_video`, `resolution` becomes `quality`, and boolean `audio=false/true` becomes the verified numeric graph switch `0/1`. Reference video dependencies materialize provider `file_path` values into `customer_img_paths/customer_video_paths/customer_audio_paths`; `image_to_video` fills `customer_img_path` only when one unambiguous image dependency exists. Adapter v2 does not map `create_count/count/n`, so each generation node produces one output. Multiple outputs require multiple nodes. Conflicting fields, ambiguous images, unknown modes and URL-only references fail closed.

Other generation nodes follow adapter selectors too. `image_generate` uses `text_to_image/image_to_image`; image-to-image dependencies must materialize provider paths, and model, quality, aspect, detail and reference counts follow the offline image capability. `audio_generate` uses `text_to_music/text_to_speech`: validate lyrics/instrumental/automatic-lyrics selection for music, and `voice_id/provider_voice_id` plus model-specific controls for speech. The music adapter does not map `duration_seconds`; do not set `duration_auto=false` and assume a manual duration reaches Create. `text_generate` has a full payload schema but no Create adapter; validate its prompt/model against that schema.

Normalization applies to the single guarded submission, without rewriting the caller's local patch. Post-submission readback and checkpoint establish the state bound to later approval. Existing malformed historical nodes are never silently modified during paid preflight.

Composition uses `payload.tracks`: exactly one video track and zero or more audio tracks. Reference successful sources through `material.node_id`, also listing every source ID in top-level `depends_on`. `clip` / `timeline` use milliseconds; material `duration` / `video_info.duration` use seconds.

For new nodes without `position`, the wrapper fills layout in the same patch before submission. Local anchors come from `depends_on` and payload node references; compositions anchor to all `material.node_id` sources. Prefer placement centered to the right of their bounding box; on collisions try below/above/left and local fan-out. Use 60 px default spacing, about 40 px visible clearance and a 20 px grid. Preserve explicit positions and existing nodes. Use the viewport only when no related nodes exist. Do not append everything to the graph's far-right edge or rearrange the whole canvas.

Routine composition with known fields goes directly through guarded `patch apply`, without an extra `patch dry-run`. Both perform structural/contextual validation; apply then saves and checks `valid` and `applied`. Dry-run is for explicit validation-without-saving requests or concrete unresolved validation questions after reading the contract. It cannot discover fields or replace sync, version conditions, readback or paid preflight.

### Before Mutation

1. Require `--json` or `-p` for a verifiable receipt.
2. Read the latest graph once.
3. Require a readable, accepted `.canvas-sync-state.json`.
4. Compare using its recorded layout mode.
5. Return `canvas_external_changes_detected` without mutation for unaccepted semantic changes.
6. Require the command version to match current `edit_version`; bound paid plans may advance only with the complete content proof described below.
7. Reject other stale versions with `canvas_edit_conflict` or `canvas_confirmation_plan_stale` for paid plans.

After a conflict:

```text
canvas sync → inspect affected nodes → rebuild patch from contract → apply
```

Add dry-run only if separate validation before saving is necessary. Version conflict alone does not require it. Never just substitute a newer version into an old patch whose assumptions may be stale.

### Mutation Execution And Paid Preflight

Submit once. Never replay automatically after timeout, failed readback or unknown state. Preserve parseable original CLI stdout, stderr and exit code. The same patch retains the internal CLI's stable idempotency key.

Commands that can start generation (`canvas dispatch`, `canvas graph reconcile`, `canvas node rerun`) require separate `canvas paid preflight --operation ...`. It validates setup, login, membership, balance and target `content_type/model`, returning `pixverse.canvas_paid_preflight.v1`. Preflight only reads remote state, performs no mutation and does not carry `--require-dispatch`.

Before account lookup it validates adapter-v2 image/video/audio fields, material references and schema-only text prompt/model. Missing or noncanonical `gen_type`, legacy `resolution`, unmaterialized provider paths, missing image-to-video `customer_img_path`, multiple-output counts, nonnumeric graph `audio`, or invalid explicit duration/quality/aspect/audio/reference values return `canvas_paid_target_contract_invalid` with `repair.set_payload_fields/remove_payload_fields`. Repair through guarded patch, sync and re-preflight. Rejection creates no approval plan or paid mutation.

Preflight reads one merged `capabilities canvas` result and carries route mappings and `cli.capability` through validation, without separately reverse-engineering graph types from the offline Create registry. Adapter mappings determine which explicit fields enter the Create contract. Do not add generic CLI defaults or invent unmapped graph fields.

The legacy Basic/Free Canvas contract permits only `qwen-image` image nodes and `v6` video nodes; unverified targets or membership routes fail closed. Current generation defaults, upgrade gates and explicit fallback consent remain governed by `skills-shared/quality-policy.md`; these legacy constraints do not authorize automatic fallback. A stable account fingerprint and active workspace ID are mandatory; otherwise return `billing_context_unknown`.

Preflight writes an immutable, single-use plan to `.canvas-paid-confirmation-plans.jsonl`, binding project, edit version, nodes, model routes, account, workspace, membership, balance and complete mutation arguments except the wrapper-owned run ID. Show node/task counts, model routes, balance and snapshot time. Per target, disclose mode, applicable duration/quality/aspect/audio/image detail, output count, image/video/audio reference counts and ordered fingerprints, resolved media source node IDs, and prompt preview/fingerprint. Do not mislabel text or other ordinary dependencies as media sources. The full graph hash prevents hidden changes but does not replace user-visible parameter confirmation.

Follow returned `confirmation_required` / `confirmation_policy`: effective `require` waits for one explicit approval, then uses the returned `--confirmed --confirmation-plan-id <id>` command; `skip` directly uses the returned `--run-if-allowed --confirmation-plan-id <id>` command. Never exchange these local wrapper flags manually. The wrapper revalidates all bindings and removes local flags before calling CLI. Changed state returns `canvas_confirmation_plan_stale`; consumed plans return `canvas_confirmation_plan_already_used`. Legacy unconfirmed mutations return bound plans for compatibility but are no longer the skill's entry point. Direct `--confirmed` without a plan returns `canvas_confirmation_plan_required`.

Canvas uses existing quote-confirmation precedence, without rewriting preferences or classifying native composition as free. Default `skip` covers first and subsequent batches without a prior receipt. Requests to control spending or confirm batches enable project `require`; "Allow future generation" restores `skip`. New project choices acknowledge current global settings; later global choices supersede older project choices. Upgrades preserve explicit preferences. Receipts remain duplicate-prevention/recovery evidence. Repository fallback bindings use global/default policy. Ordinary queues share the same rules. Handoff `approval_gate` is `not_required` or `required` according to effective policy, not merely the presence of paid tasks.

The plan digest binds authorization basis and scope. Execution rereads preferences; revoked/unreadable skip returns `canvas_confirmation_preference_required` and needs new preflight, never a manually substituted execution flag. Preflight remains read-only even under skip. An affirmative response to the displayed sheet approves it without a fixed keyword or another question; an initial generation request does not approve an unseen require-policy plan. Host tool approval remains independent.

When a completed intermediate is the known next-batch input, finish free node preparation, sync and read-only preflight first. Show intermediate inspection status, source IDs, edit version and the complete next sheet together. One affirmative response accepts the source and authorizes the bound batch. Separate review only when explicitly requested or when a material next-stage choice remains unresolved.

Each target includes `operation_class`, `route_display` and `render_intent`. Native composition displays `Canvas native compose (no generation model)` while retaining paid guards. Intents are `first_render`, `retry_render`, `rerender_existing` and `resume_existing`. Running/dependency-blocked targets return `canvas_generation_already_in_progress` before balance lookup, with no new plan; follow/reconcile the existing run. The same applies when graph status has not propagated but the local ledger contains a durable submission without terminal reconciliation. `patch apply` means only `configuration_saved`. Viewing/reusing results or continuing downstream work does not dispatch. Rerendering requires an explicit request for a new render/version.

### Bound Content And Version Rebasing

Authorization content and execution version are checked separately. Binding v2 stores a SHA-256 of the normalized complete graph, conservatively covering prompts, negative prompts, model parameters, counts, references, upstream text/materials, connections and composition track order/timing/volume.

Exclude only reviewed display-layout and metadata paths. Normalize only reviewed Web equivalences: identical title copies in `data.extra.title`; empty `customer_img_paths/customer_video_paths/customer_audio_paths` on known image/video generation nodes; and text/script content represented as plain text or simple ProseMirror paragraph JSON. Different titles, nonempty references, unrecognized rich text or changed body text invalidate approval. Do not recursively ignore every similarly named field: `data.params.style` and track `position` remain content. Unknown fields remain bound unless proven irrelevant.

On execution, `--project-id` is plan-bound data and does not rewrite local project/region bindings. Region mismatch stops before local writes or remote reads. Verify the immutable plan, consumption record, full content, account and all other bindings. Only when all match, layout comparison is not enabled, and the version advanced may the wrapper internally update submitted `--edit-version` to the latest pre-read version without another approval. The caller must not edit it; the saved plan remains immutable. Before submission, ledger fields record `approved_edit_version`, `submission_edit_version`, `edit_version_rebased` and content fingerprint. The API still atomically checks the latest version; a new race fails without automatic retry.

Content, account, workspace, membership, balance or command-option changes, version rollback, or old plans lacking complete fingerprints require new preflight and its effective confirmation policy. Sync alone does not revive old authorization. Never silently upgrade old plans. Check consumption before graph/account changes: a consumed plan returns `canvas_confirmation_plan_already_used` with the original `run_id`, even if nodes now show `RUNNING`; recover that run rather than creating a fresh paid plan.

### Durable Submission And Attribution

Before each authorized submission, fsync `submission_started` to:

```text
projects/<slug>/.canvas-paid-runs.jsonl
projects/.canvas-paid-runs.jsonl
```

Append `submission_result` and `reconciliation` with run ID, targets, receipt task IDs, node states, output references and pre-submit safety information. Ordinary Canvas work does not query post-generation balance, download, run local QA, request `account usage` or assemble invoices. Unrequested downloads/credits are `not_requested`, with null credits rather than pending, failed or zero consumption. Only explicit `--credits` queries post-generation balance, using `account_balance_delta` and disclosing possible unrelated spending since the initial snapshot. Pre-submit records preserve uncertain requests even after process failure.

The wrapper generates a fresh positive decimal CLI `--run-id` for every submission, replacing any caller value, and stores pre-submit task/history baselines. Receipt parsing reads `dispatch_status`, dispatched/deferred/skipped nodes and new task/history IDs:

- Exit 0 with `skipped/no_ready_nodes` means `not_started`.
- Nonzero exit with `dispatched_node_ids` is partial `started`; reconcile only started nodes.
- For nonzero exits, a complete structured JSON error may be in stderr. Accept one complete JSON receipt from stdout or stderr. Explicit failed/rejected receipts with validation errors for every target and no dispatched/task/history/rerun evidence mean `not_started` / `deterministic_validation`. Return field errors immediately; do not enter a 300-second attribution wait.
- Other nonzero exits, timeouts and disconnections without clear non-submission evidence are `unknown`. Preserve targets for reconciliation; current node state alone does not prove failure or safe retry.

Generation and credit observation are independent. Once a target reaches `SUCCEEDED`, sync its state and continue ready downstream work without waiting for balance refresh.

For ordinary progress, use one nonblocking refresh:

```bash
scripts/pvx canvas paid reconcile --run-id <run-id> --deadline-seconds 0 --format markdown
```

`generation_status` / `downstream_ready` report generation and dependency readiness. Only explicit `--credits` populates observed `credits_consumed` / `credits_source`. `attribution_complete` is generation ownership/retry-safety evidence, not usage-invoice matching. Use bounded attribution waiting only before retries or for ambiguous-submission recovery:

```bash
scripts/pvx canvas paid reconcile --run-id <run-id> --deadline-seconds 300 --format markdown
```

Normal generation waiting and first-asset display use bounded follow:

```bash
scripts/pvx canvas paid follow --run-id <run-id> --project <slug> --format markdown
```

Follow defaults to an 1800-second deadline, backing off through 2, 5, 10, 20 and 30 seconds. Keep waiting for `BLOCKED` nodes while upstream nodes in the batch remain `RUNNING`. Read the full graph for cloud output references only when a new node succeeds. After `Canvas node ready`, preview it while remaining nodes continue in the same process.

Follow/reconcile default to status and cloud references only, including at terminal state. `--download` explicitly enables downloads; `--download-node-ids <id,id>` limits them to selected submitted nodes. `--credits` independently enables terminal credit queries. Resolve download media IDs from current results or this run's attribution, never arbitrarily from historical ID sets. Retry free download failures or unpropagated IDs at most three times, without regeneration. Terminal generation does not wait for audit attribution.

These rules apply only to an explicitly selected Canvas target, not merely a directory binding. The Canvas Skill's **Cloud Preview And On-Demand Delivery** is authoritative. Preview in Codex IAB or return the direct Canvas link when unavailable; do not automatically download. Inspect cloud previews and existing metadata, marking unverified resolution/audio and other properties `not_checked`. Requested parameters are not QA evidence. Downstream nodes reuse cloud references without local files.

Use `project resume` / `portfolio` / `handoff --surface canvas`; do not use ordinary queue `qa project` or ledger repair for missing Canvas media. Explicit local MP4/file requests still require export, download and necessary file checks. Record local delivery using `--delivery-mode local` and repeated `--deliverable-path <file>`; missing files cannot be marked delivered. Download does not imply credit queries.

At each meaningful stage, `project handoff --surface canvas` writes a `canvas.stage.handoff` manifest record using `--stage-position`, `--final-deliverable-status`, repeated `--remaining-stage`, `--next-paid-task-count`, `--next-paid-task` and `--approval-gate`. Later handoffs read the latest record. `localized_preview_copies` comes only from successful `task.localized` files written by paid follow, never from local masters or user-supplied media.

Reconciliation polls actual dispatched/rerun targets. Attribute terminal graph status only when its CLI run ID matches or current task/history IDs explicitly intersect the submission receipt. A matching run ID without receipt IDs permits complete pre-submit baseline deltas as owned IDs. Without matching status run ID, unmatched new baseline IDs remain diagnostic; they do not claim concurrent tasks. An explicit mismatched run ID overrides all ID evidence. Old `SUCCEEDED` state is never credited to a new run. Unresolved ownership returns `status_unattributed`.

Reject NaN/Infinity; cap poll intervals at 300 seconds and deadlines at 24 hours. Every graph/status subprocess has a finite timeout. Immediate mutation readback uses the same ownership rules. Account/workspace mismatch around credit reads records `billing_context_mismatch` and suppresses balance comparison.

### After Mutation

1. Read the graph once after CLI success.
2. Compare pre/post semantic changes.
3. Verify receipt `edit_version` against readback.
4. Save the checkpoint when they match.
5. For `patch apply`, accept a higher readback version only when the complete patch semantics are present and additional changes are solely normally ignored layout/volatile fields.
6. Missing versions, other command-version mismatches, extra semantic changes or failed readback return `mutation_applied_verification_unknown`. Do not accept the snapshot or retry.
7. Use `canvas sync` for a fresh agent/user review.

Higher-version acceptance applies only to fully proven `patch apply`, never dispatch/rerun/reconcile, `--include-layout` checkpoints or extra node/connection/project semantic changes.

## Atomic Capability Matrix

| Command | Concurrency condition | Default behavior |
|---|---|---|
| `canvas patch apply` | `graph_patch.base_edit_version` | Execute after atomic validation |
| `canvas dispatch` | `--edit-version` | Execute after atomic validation |
| `canvas graph reconcile` | `--edit-version` | Execute after atomic validation |
| `canvas node rerun` | `--edit-version` | Execute after atomic validation |
| `canvas dispatch rebind` | No current CLI version condition | Block |
| `canvas node extract-audio` | No current CLI version condition | Block |
| `canvas node version apply` | No current CLI version condition | Block |

For commands without atomic conditions, one read before and after is not full concurrency protection. After explicit risk acceptance, callers may use the local wrapper flag:

```bash
--allow-non-atomic-canvas-mutation
```

It is removed before invoking CLI; only best-effort pre/post reads remain.

## Polling Boundaries

There is no persistent Canvas content watcher:

- Sync reads once and exits.
- Pre-mutation checks read once, then proceed or block.
- Post-mutation verification reads once and exits.
- Browser inspection does not poll DOM; refresh at most once when needed.
- Asynchronous generation uses separate bounded CLI/queue polling ending on success, failure, cancellation, timeout or deadline.
- Paid follow requires a positive deadline (default 1800 seconds), ends at terminal state by default, and performs bounded free retries only for explicit downloads. Read failure, exhausted retries or deadline stop it. Cloud previews do not wait for attribution.
- Paid reconcile defaults to deadline 0 and one read. Explicit positive deadlines enable bounded polling; recommended recovery is 300 seconds, hard cap 24 hours. Inputs must be finite; reads have hard timeouts. Success, failure, unknown status, read failure or deadline ends the wait.

Future SSE/WebSocket events may trigger sync but would not themselves become authoritative graph content.

## Errors And Recovery

| Error | Mutation executed? | Recovery |
|---|---|---|
| `canvas_external_changes_detected` | No | Sync, inspect differences and rebuild |
| `canvas_sync_checkpoint_required` | No | Run and review sync |
| `canvas_sync_state_invalid` | No | Review cloud graph, then reset checkpoint |
| `canvas_sync_layout_mode_change_requires_reset` | No | Confirm mode and explicitly reset; preserve old checkpoint meanwhile |
| `canvas_sync_lock_timeout` | No | Wait for current local work, then reread; do not forcibly delete lock files |
| `canvas_project_binding_invalid` | No | Repair using a known ID; no automatic creation |
| `canvas_project_binding_update_failed` | Yes / possibly | Do not retry creation/mutation; repair with returned project ID |
| `canvas_workspace_override_unsupported` | No | Select active workspace and remove override |
| `canvas_mutation_json_required` | No | Add `--json` or `-p` |
| `canvas_edit_version_required` | No | Build a versioned command from current graph |
| `canvas_edit_conflict` | No | Sync, reread and rebuild |
| `canvas_atomic_guard_unavailable` | No | Wait for CLI version support or explicitly accept non-atomic operation |
| `canvas_paid_confirmation_required` | No | Legacy path; use separate paid preflight |
| `canvas_confirmation_plan_required` | No | Do not append confirmation flags manually; run read-only preflight |
| `canvas_confirmation_preference_required` | No | Skip is no longer effective; re-preflight and follow policy |
| `canvas_confirmation_plan_stale` | No | Graph/account/balance changed; create and show new preflight |
| `canvas_confirmation_plan_already_used` | No | Reconcile the existing run; never replay |
| `canvas_confirmation_plan_not_found` | No | Return to the original project directory or create new preflight |
| `canvas_confirmation_plan_state_unreadable` | No | Preserve and repair unreadable plan/ledger; no submission |
| `canvas_paid_targets_unreadable` | No | Sync and verify all targets/models are readable |
| `canvas_generation_already_in_progress` | No | Follow/reconcile the active run; no new plan for active targets |
| `billing_context_unknown` | No | Restore verified account/workspace with auth status/account info/doctor, then preflight |
| `membership_route_required` | No | Resolve membership under current quality policy and explicitly accepted supported fallback, then preflight |
| `canvas_video_contract_invalid` | No | Repair conflicting/ambiguous video fields and guarded apply |
| `canvas_paid_target_contract_invalid` | No | Apply returned repairs, sync and re-preflight |
| `deterministic_validation` submission rejection | No | All targets rejected before submission; repair, sync and re-preflight without attribution waiting |
| `canvas_paid_ledger_write_failed` | No | Repair directory permissions; no paid submission without durable audit |
| `billing_context_mismatch` | Started / unknown | Restore preflight account/workspace and reconcile the same run; do not settle from current balance |
| `status_unattributed` | Unknown / started | Preserve ledger and verify task/history/run IDs; do not claim old results or resubmit |
| `mutation_applied_verification_unknown` | Yes / possibly | Do not retry; sync and verify |

## Distribution Isolation And Capability Parity

Online/public and local/internal retain separate CLI sources, runtime directories, setup state and environment selection. Canvas capability is not gated by channel name. Both validate the current CLI's offline `capabilities.json` first:

- CLI version at least `1.4.0`, capability schema `1.2.0`;
- Canvas domain declares reviewed runtime discovery;
- All runnable Canvas command names, effects, arguments and subcommands exactly match the wrapper contract;
- No unreviewed, missing or duplicate runnable Canvas commands.

After validation, both use the same automatic binding, checkpoints, version guards, post-verification, paid plans and recovery. Failure returns `canvas_wrapper_contract_unsupported` before automation; never fall back to unguarded passthrough. Local installs still use bundled ZIPs and can select preview/test; online installs use npm `latest` and production Web addresses. Distribution differences do not alter Canvas safety semantics.

## Acceptance Criteria

- First sync establishes a snapshot; later Web additions/updates/deletions are reported.
- Node movement alone does not cause default semantic differences.
- Unaccepted Web changes block mutations.
- Missing/corrupt/incompatible checkpoints are not silently accepted.
- Changing layout comparison does not hide concurrent semantic edits; layout-aware checkpoints still support mutation.
- Stale patches/commands are blocked before submission.
- New nodes without coordinates are placed near their sources; explicit/existing positions are preserved.
- Mutations execute once; missing receipt versions, failed post-reads or advanced versions do not cause replay or false checkpoint acceptance.
- Dispatch/reconcile/rerun cannot generate without required preflight and policy authorization.
- Configuration saving, first render, active-run recovery, retry and rerender have distinct machine-readable states.
- Unsupported premium models on Basic/Free are blocked; paid submissions first write durable ledger records.
- No-op, partial dispatch and old successes do not misreport generation or credits.
- Creation has durable intent; corrupt/unwritable bindings never cause duplicate remote creation.
- Reconcile respects its deadline, queries balance only with `--credits` and never requests account usage.
- Follow defaults to no download, local QA or post-generation balance query; cloud delivery/recovery does not require local media.
- Downloads and credit queries are independent; local delivery requires real files; ordinary queue behavior is unchanged.
- Both channels share wrapper behavior for reviewed commands and fail closed before remote calls on contract drift.
- An installed local copy can sync a real project.

Local packaging also validates every runnable Canvas command in the internal ZIP bidirectionally against the reviewed contract. Names, `run`, `auth`, `effect`, `destructive`, positional arguments, children, exact option declarations and descriptions must match, including `<id>/<n>` value shapes, requiredness and ranges. Added/removed commands, changed effects/destructiveness, unreviewed options, changed meanings, missing `--edit-version` or value-to-boolean changes fail packaging until policy and tests are updated.

Implementation:

- `pvx/canvas_sync.py`: snapshots, normalization, semantic diff, locks, state I/O and CLI capability contract;
- `pvx/cli.py`: prepare/sync, pre/post mutation guards, paid ledger/reconciliation and timing;
- `tests/test_canvas_sync.py`: synchronization unit tests;
- `tests/test_cli.py`: conflict, single-submission and dual-channel behavior tests.
