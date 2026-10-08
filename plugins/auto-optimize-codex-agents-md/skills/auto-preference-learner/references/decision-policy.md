# Decision and Application Policy

## Purpose

Define how to judge historical feedback as an acceptable project or global `AGENTS.md` rule and how authorization and state work for Suggest, confirmed Suggest, Auto, rejection, and withdrawal. Apply these gates and state rules during first-time or incremental review, reconciliation, and application. This file does not parse Codex JSONL, split review batches, or export transcripts.

## Contents

- Judgment objective
- Candidate gate
- Coverage and semantic decomposition
- Scope
- Decision structure
- Action semantics
- Suggest review
- Auto and Git
- Tombstones and state

## Judgment Objective

Use as few instructions as possible while keeping them accurate and precisely scoped so future Codex behavior better matches the user's stable expectations. Prioritize aesthetic and quality preferences, acceptance criteria, communication habits, behavioral boundaries, safety and authorization preferences, and stable cross-task habits.

Do not create or update workflow Skills from historical feedback. Do not proactively govern ordinary intermediate methods. This is a boundary of this Skill, not a Codex-wide refusal: route an explicit workflow-Skill request to an appropriate creation capability.

## Candidate Gate

Treat these as candidate signals, not rules by default:

- The user explicitly corrects an outcome, communication style, or authorization boundary.
- The user shows clear dissatisfaction and both the problem and an actionable improvement are identifiable.
- The user provides a reusable aesthetic judgment or acceptance criterion.
- The user explicitly asks to add, modify, or withdraw an `AGENTS.md` rule.

A single feedback event may qualify; repetition is not required. It must still identify a concrete problem, prescribe executable behavior, have a reasonable semantic scope, and carry low side-effect risk. Emotion alone is not dissatisfaction, but strong emotion accompanying an explicit, actionable correction increases confidence that the correction matters and should strengthen the presumption toward Suggest. It does not override semantic scope, side-effect risk, exact existing coverage, or a clearly task-specific meaning. Use no-op for one-off factual corrections, task-specific exceptions, non-executable opinions, feedback that conflicts with facts and cannot become a collaboration improvement, or rules that would materially reduce autonomy.

## Coverage and Semantic Decomposition

Pass every batch through `prepare_review_chunks.py`, which splits it by project and configured record and character limits, then review every chunk. All batch sizes follow the same path; each project stays in one chunk unless a limit requires more. Process the entire manifest rather than only globally ranked, keyword-matched, or sampled records. After merging decisions, continue to use the source batch as the reconcile, apply, and checkpoint unit. Maintain coverage per project. Split explicit corrections, dissatisfaction, acceptance criteria, and withdrawal requests into independent semantic atoms. Each atom must map to a candidate, an existing rule that covers it exactly, or a specific no-op reason. A partially related rule does not cover all other feedback in that project, and topical similarity is not semantic equivalence.

Every project decision, including no-op and `needs_evidence`, must contain trusted `evidence_refs`, an accurate project root, and a separate `global_disposition`. A record with no trusted project root may instead use a global decision with unscoped evidence. The disposition is `candidate`, `project-only`, or `already-global` and requires a specific reason. A candidate also supplies the proposed global instruction, semantic scope, and whether the user explicitly made its scope global; an unscoped global-context candidate must set that flag to true. Local action and global applicability are independent: an exact project rule can make the project action a no-op while the same history remains evidence for a global candidate. A no-op must also contain a specific `explanation`. Every record in the batch must be referenced directly by at least one decision or indirectly through a trusted turn or event reference for that record. Reconcile and apply both enforce coverage; any omission blocks checkpointing for the entire batch.

After every project chunk is complete, aggregate all structured global candidates across projects before reconciliation. Include unresolved candidates carried from earlier incremental runs. Every candidate must receive exactly one `promote`, `keep`, `reject`, or `already-global` outcome. Implicit global promotion requires evidence from at least two distinct project roots; one explicit global instruction may enter Suggest from one project. Keep a single-project implicit candidate in state so later evidence from another project can complete the cross-project signal. Project-level no-op never skips or settles this global pass.

Return the global review in this shape. Include `decision` only for `promote`; it must be a mutating global decision. The finalizer derives its evidence and source projects from the referenced candidates rather than trusting model-written provenance.

```json
{
  "groups": [
    {
      "candidate_ids": ["G-..."],
      "outcome": "promote | keep | reject | already-global",
      "decision": {
        "action": "add | merge | narrow | replace | remove",
        "target": "global",
        "instruction": "global rule"
      }
    }
  ]
}
```

Prefer instructions of this form:

```text
When <semantic applicability condition>, take <expected action> because <necessary failure mode or objective>.
```

Keep the reason only when it helps define scope or prevents mechanical application.

## Scope

- **project**: project-specific aesthetics, repository acceptance criteria, technical or delivery conventions, and preferences not yet shown to apply across projects.
- **global**: behavior the user explicitly requires in every project, cross-project communication or safety boundaries, and stable habits observed consistently across projects. One explicit global signal may enter Suggest; unattended Auto requires evidence from at least two distinct project roots for a global mutation.

Derive project targets from trusted `cwd` metadata in ConversationRecords. One run may cover multiple historical projects; do not restrict writes to the optimizer's own repository. Every project write must end at `<project-root>/AGENTS.md`.

## Decision Structure

Return a JSON array. Use this shape for each decision:

```json
{
  "decision_id": "optional opaque internal stable id",
  "action": "add | merge | narrow | replace | remove | no-op | needs_evidence",
  "target": "project | global",
  "project_root": "project target only",
  "instruction": "new managed rule",
  "existing_instruction": "remove/narrow/replace target",
  "existing_instructions": ["merge target 1", "merge target 2"],
  "reason": "only when useful",
  "semantic_scope": "applicable situations",
  "evidence_refs": ["session/turn or record id"],
  "explanation": "why change or no-op",
  "confidence": "low | medium | high",
  "risk_of_overconstraint": "low | medium | high",
  "evidence_query": null,
  "restore_tombstone": false,
  "restore_tombstone_ids": [],
  "override_prior_rejection": false,
  "override_rejection_ids": [],
  "supersedes_decision_id": null,
  "global_disposition": {
    "status": "candidate | project-only | already-global",
    "instruction": "global candidate only",
    "semantic_scope": "global candidate only",
    "reason": "specific classification reason",
    "explicit_global_intent": false
  }
}
```

Omit action-specific fields that do not apply. A `needs_evidence` decision must provide an `evidence_query` bounded by source, lines, and event kinds. After retrieving evidence, replace it with a final action rather than passing it directly to reconcile.

A non-empty batch must not return an empty decisions array. If nothing is worth changing, return at least one explicit `no-op` that explains why the batch contains no durable rule. An empty or missing decisions array is a judgment failure and must not checkpoint.

Every mutating decision must include at least one `evidence_ref` from a current batch record, its stable session+turn/source reference, or auditable episode context. Reconcile and apply both verify that references belong to the batch's trusted reference set. For a project decision inferred from ordinary session history, every reference must also have a known project root matching the target; evidence from project A or from an unknown root cannot authorize project B. Current-conversation evidence may authorize project B only when the user explicitly supplied B as a project root in this invocation. That explicit root must also be in the allowlist and travel through the manifest, batch, and plan. A bare session ID is ambiguous in a cross-project session, and a bare turn ID is not globally unique across sessions, so neither is trusted. Never submit an Auto rule with missing, fabricated, or cross-project evidence.

## Action Semantics

Judge actions in this order:

1. **no-op**: an existing rule already covers the meaning, or the candidate is not worth persisting.
2. **remove**: the user withdraws an existing rule; provide the exact `existing_instruction`.
3. **narrow**: an existing rule is too broad; provide both the old rule and the narrowed replacement.
4. **merge**: multiple rules can be consolidated; provide every exact old rule and the new rule.
5. **replace**: a new explicit user instruction supersedes an old rule.
6. **add**: a genuinely new preference is not already covered.

A current explicit user instruction outranks historical inference. Do not rewrite an equivalent rule merely because its wording differs.

If deterministic reconcile finds that an `add` exactly matches a normalized instruction line in the current project file, in its managed block, or in a global rule effective for that project, convert the decision itself to `no-op`. Do not leave an add, pending, or auto-applied state merely because the generated diff is empty. The judgment layer must no-op semantic equivalents with different wording after reading currently effective rules.

Treat an earlier equivalent add in the same batch as an existing rule. Keep only the first mutating decision and convert later duplicates to actual no-op decisions.

## Suggest Review

Default to Suggest and never upgrade it automatically to Auto. Reconcile assigns consecutive plan-local `selection_number` values such as `1`, `2`, and `3` only to reviewable changes. Show these numbers to the user without displaying or requesting internal `decision_id` values. Keep internal IDs for persistent state, audit, and cross-batch links. Accept natural-language acceptance, editing, rejection, or withdrawal without requiring fixed command syntax.

Suggest writes only optimizer state and a report, not target files. The user accepts rule semantics: after acceptance, create or update the file as needed without separately asking whether to create `AGENTS.md`. Reconcile an edited acceptance again using the user's final text. Rejection prevents the same candidate from recurring but does not withdraw an existing rule.

Require explicit selection of one or more visible numbers when confirming a Suggest. Use `--all` only when the user explicitly accepts every item. Apply resolves visible numbers to internal IDs before execution. Before writing, reread current state only for selected decisions. If feedback in the same scope was withdrawn or rejected after plan generation, stop that decision even if wording or fingerprints changed, unless an explicit restore or override is present. A stale unselected decision must not block an unrelated accepted item.

Whether confirmed Suggest writes create a Git commit follows the user's persisted first-run preference; default to no when unset. When enabled, commit only the target `AGENTS.md`, leaving every other repository change untouched. Global files and non-Git projects have nothing to commit, so write and report them without a commit.

An accepted edited decision must point to its original pending decision through `supersedes_decision_id`. Reconcile it against the latest state, verify the pending item, scope, and evidence, and limit the edited plan's record range to records both covered by the final decision and new in the source batch. Previously processed episode context may remain trusted evidence but must not checkpoint again. Then apply it atomically with `confirmed-suggest --all`, closing the old pending item and recording edited acceptance. If the final wording is already effective and becomes no-op during reconcile or apply, still treat it as accepted, close the original pending item, and record the same outcome.

## Auto and Git

Auto requires explicit user authorization. Replay managed decisions on the current `AGENTS.md`, so manual content outside the managed block and unrelated workspace changes do not block it. Stop the target and report a conflict if markers are malformed or an old managed rule has changed so it can no longer be matched exactly.

During Auto judgment, mutate only high-confidence candidates with low overconstraint risk. For all others, gather the minimum necessary evidence or use no-op; do not turn them into Suggest items that require individual review, because Auto is unattended.

Code must enforce `confidence=high` and `risk_of_overconstraint=low` for every Auto mutation. Apply may accept only a current `mode=auto` plan and must never promote an old Suggest plan. Plan errors, unresolved `needs_evidence`, blocked or unknown quota, and target application failures must not checkpoint the affected batch.

Reread current state before applying. Increment the monotonic `constraint_revision` and relevant target-scope revision after each rejection or applied mutation, including accepted, withdrawn, restored, and Auto-applied changes. An Auto plan stores its revision plus tombstone and rejection guards so an `empty -> blocker -> empty` ABA state transition cannot revive a stale plan. For selected remove, merge, narrow, or replace actions, confirmed Suggest checks the scope revision so an old removal cannot undo a later explicit restoration. Changes in other scopes must not block the selected item. Later state, missing paths, or errors in unselected items must not block unrelated explicit acceptance. Explicit restore and override flags still follow current user authorization.

For a Git project, Auto commits after writing and includes only the target `AGENTS.md`; never stage or commit another path. For a non-Git project or global `$CODEX_HOME/AGENTS.md`, complete the atomic write and report that no Git commit applies.

Before an Auto write, preserve the target's original bytes and its existing Git index entry. If `git add` or `git commit` fails, restore both and leave the records uncheckpointed so the same add, remove, merge, narrow, or replace plan can be retried without touching other working-tree or index state.

The project root must still exist at apply time. A missing root-level `AGENTS.md` may be created, but a project directory deleted after planning must not be recreated recursively. Reject project and global `AGENTS.md` targets that are symbolic links. Compare target paths as lexical absolute paths without dereferencing the link so writes cannot escape an authorized root.

A plan target stores only top-level decision IDs. Apply must verify that every mutating decision belongs to exactly one target matching its scope and root and must execute only decisions that pass top-level evidence and Auto gates.

Every apply must independently read the batch that produced the plan. Reconstruct authorization from its `codex_home`, `allowed_project_roots`, `explicit_project_roots`, record IDs, and evidence references and project scopes derived from records and episodes. Stop if path sets or record IDs differ from the plan, if decision evidence is absent from the batch, or if project evidence is scoped incorrectly. Never trust the plan's self-reported allowlist or evidence map. For global Auto, both reconcile and apply must independently verify evidence from at least two real project roots.

Before replaying an `add`, apply rereads effective instruction lines from the latest project file and global `AGENTS.md`. If the same normalized instruction was manually added after planning, added by another run, or is already globally effective, record the decision as a runtime no-op instead of creating a managed duplicate.

## Tombstones and State

Record an applied remove as a tombstone. Fingerprint tombstones and rejected candidates by target scope, project root, and normalized rule meaning. A new rule produced by merge, narrow, or replace first inherits provenance from every replaced rule, then adds current evidence. A removal tombstone stores withdrawal evidence and inherits the removed rule's complete provenance references.

Reconcile must read state on every run. Block old history from reviving a rule both by fingerprint and by overlapping feedback evidence in the same scope. Only a later explicit user restoration may set `restore_tombstone: true` and, when needed, list original `restore_tombstone_ids`. Applying restoration clears old tombstones in the same scope that are explicitly listed or overlap in evidence, even when restored wording differs. Use corresponding override fields and IDs for rejected candidates.

Stop and return a reconcile error if a plan would grow UTF-8 `AGENTS.md` content beyond 32 KiB; require merge, narrow, replace, or remove instead. An already oversized file may still receive a no-op or a change that does not grow it.

Deduplicate `add` actions immediately within a batch. If a narrow, replace, or merge result already exists as an equivalent managed rule, remove the superseded old items and reuse the existing equivalent rather than creating a duplicate.

State stores current operational data: processed record IDs, pending decisions, scoped rejected candidates, tombstones, rule evidence, revisions, preferences, cursors, and the latest run metadata. Store run outcomes, actual diffs, hashes, and commits in the audit log and report rather than keeping historical result copies in state.

Run the entire apply operation under an exclusive cross-process lock in the state directory. Append the decision audit log and atomically write the report before atomically replacing `state.json` to publish the checkpoint. If logging or report writing fails, do not publish a processed checkpoint. Overlapping scheduled runs must not overwrite state concurrently.
