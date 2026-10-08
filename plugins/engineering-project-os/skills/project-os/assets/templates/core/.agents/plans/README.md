# Implementation plans

`index.json` schema 2 is the only plan status register. A new plan has id, status, path, outcome and contract_path. Simple bounded tasks do not need a plan. Create one just in time when work must survive checkpoints or needs explicit evidence gates.

Status values are planned, active, blocked, done and superseded. Running execution requires exactly one active plan; the optional active_plan pointer must match. Idle execution has no active plan. Opening records the intended outcome without performing it.

The Markdown plan describes baseline, scope, implementation, interfaces, decisions and sequence. Keep it under 200 lines. Its adjacent JSON contract owns acceptance, avoiding a second independent checklist of proof. Every condition required for the outcome belongs in the contract, including remote prerequisites when applicable. Missing permissions or access do not make a condition inapplicable.

## Markdown template

```markdown
# Plan NNN: One observable outcome

## Baseline and scope

Source commit, current state, outcome, boundaries, explicit exclusions and relevant knowledge.

## Implementation and interfaces

Tasks, affected callers, compatibility, rollout and rollback requirements.

## Decisions and revisions

Material changes, controlling request IDs and their reasons. Increase contract revision and reassess evidence when the outcome changes.

## Acceptance and next action

The adjacent JSON contract owns gates. Link detailed evidence here for context, then leave one exact next action.
```

## JSON contract template

```json
{
  "schema_version": 1,
  "plan_id": "001",
  "revision": 1,
  "gates": [
    {
      "id": "effective-schema",
      "condition": "The target schema supports the requested behavior.",
      "evidence_class": "hosted",
      "target": "staging",
      "status": "pending",
      "evidence": [],
      "next_action": "Inspect the effective target schema before applying the authorized migration.",
      "reason": ""
    }
  ]
}
```

Gate states are pending, verified and not_applicable. Pending requires next_action. Verified requires evidence objects containing path, sha256, checked_on, target and revision. Use a safe repository-relative path, sha256: plus 64 hexadecimal digits, canonical YYYY-MM-DD date, the exact gate target and the current contract revision. Not_applicable requires a scope-grounded reason; the agent must judge its truth.

Use the helper plan status to report remaining gates and scoped requests. Close only through plan complete with a dry run and a checkpoint draft declaring Execution state: idle and Active plan: none on separate lines. New done records require a completion receipt matching the contract, evidence and scoped requests. Closing leaves following slices planned.

Upgrade registers historical closed statuses in legacy_closed and unfinished plans without contracts in legacy_uncontracted. Preserve the former as historical dispositions. Before resuming the latter, review and attach a contract and remove the migration mark. An uncontracted legacy plan cannot close. A fresh plan cannot use a legacy exemption.

## Request record format

Read WORKFLOW for the canonical intake and proof examples. Requests use id, recorded_on, source_text, interpretation, origin_plan, target_plan, relation, status, gate_ids and decision; use these literal keys. Save and validate each material addition or cancellation before continuing long work.

Run plan status --require-ready before any readiness claim or publication recommendation. Its nonzero result means NOT_READY even when check passes. Readiness applies only to the recorded outcome; pending host acceptance blocks a release outcome.
