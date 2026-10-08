# Durable engineering workflow

Current user and repository instructions take precedence. This managed file supplies the Project OS workflow; project facts, permissions and commands belong to repository-owned records.

## Intake and recovery

Read CONTEXT, STATE, the plan registry, unresolved requests and the active plan with its JSON contract before non-trivial work or after context compaction. Validate existing records with the selected helper check before trusting them; report and repair structural errors from their original owner before relying on recovery. When idle, inspect unresolved requests and planned slices. Load only relevant evidence and capability guidance.

Capture a material user correction, clarification or new instruction in the requests registry while handling that message, before long-running work or ending the response. Do not wait for a compaction warning or a separate instruction to save it. Use the exact JSON keys below, never aliases such as origin, target, relationship or source_formulation. Preserve the source text and the decision. Keep credentials and private data out of records. Discussion of alternatives alone is not an implementation instruction; preserve a consequential ambiguity as needs_clarification.

Integrate compatible additions to the same outcome into the active contract. Route independent outcomes to a planned slice with its own contract and explicit sequence. Preserve conflicts as needs_clarification, ask the necessary question and continue authorized independent work. Capturing and incorporating an authorized clarification requires no separate approval. External actions retain their existing authorization requirements.

Captured means saved. Integrated means routed. Implemented requires verified gates and evidence. Withdrawal requires the user's explicit cancellation or replacement, recorded in decision. Never silently discard, complete or defer an actionable requirement.

## Canonical intake and proof

The registry has schema_version: 1, next_id and requests. Append to requests, preserve existing entries and increment next_id. A request ID is R- plus at least three digits. recorded_on is the actual date in YYYY-MM-DD form. Here is one routed addition; use real plan and gate IDs:

```json
{
  "id": "R-001",
  "recorded_on": "2026-10-01",
  "source_text": "Also reject None with ValueError.",
  "interpretation": "Include explicit None rejection in the current input outcome.",
  "origin_plan": "001",
  "target_plan": "001",
  "relation": "same_outcome",
  "status": "integrated",
  "gate_ids": ["normalization"],
  "decision": "Compatible addition integrated into plan 001; verification is pending."
}
```

Allowed request statuses are captured, needs_clarification, integrated, implemented and withdrawn. Allowed relations are same_outcome, prerequisite and independent. During unresolved intake, origin_plan and target_plan may be null and gate_ids may be empty. Same-outcome and prerequisite requests must stay in origin_plan. For an explicit cancellation, update the original request to withdrawn and record the user's cancellation in decision. Do not delete it or treat the cancellation as another missing task. Revise the contract and rerun affected checks for restored behavior.

Gate statuses are pending, verified and not_applicable. Never use satisfied, done or passed. A pending gate has evidence: [] and a non-empty next_action. A verified gate needs a real repository evidence file and proof with these exact keys:

```json
{
  "path": ".agents/evidence/input-check.md",
  "sha256": "sha256:<actual 64-digit file digest>",
  "checked_on": "2026-10-01",
  "target": "local",
  "revision": 2
}
```

Compute sha256 from the actual file after writing the observed command, result and target. target must equal the gate target and revision must equal the contract revision. Reassess every retained proof on revision changes; a command/result object alone is not proof. Read the plans README when creating or changing a contract.

Immediately after saving intake, routing, withdrawal or a contract revision, run the selected helper check --target <repository>. Repair schema errors before long application work or ending the response. Resolve the helper from the selected installed skill, or the explicitly selected candidate during isolated evaluation; never guess a stale path. A failed check must be reported and cannot be treated as a successful checkpoint.

## Outcomes and contracts

Define one observable outcome and every prerequisite needed for it, including effective schema, migrations, configuration, delivery and verification in the named target when applicable. A code-only outcome is valid only when it matches the actual instruction and is stated explicitly. Do not move a required prerequisite to an independent slice to make the original plan appear complete.

The plan registry owns status. The plan Markdown owns implementation narrative and decisions. Its JSON contract owns acceptance gates and evidence. The requests registry owns intake and routing. STATE is a compact checkpoint with references, not another task register.

Before resuming a legacy_uncontracted plan, prepare its contract from current instructions and repository truth, preview the change and remove the legacy mark only after validation. Retain historical legacy_closed dispositions without claiming new acceptance.

On material outcome changes, increment contract revision and record the reason and controlling request in the plan narrative. Reassess all evidence before attaching it to the new revision. Also revalidate evidence made stale by code or external changes. Missing access, permission or proof is pending, never not_applicable. Not_applicable requires a scope-grounded reason.

## Checkpoints and closure

At each meaningful checkpoint and before a final result, readiness claim, publication recommendation or request for release authorization, run plan status --target <repository> --require-ready --json for the current outcome. Lead the report with READY or NOT_READY and name the outcome. If the command fails, any gate is pending or proof is missing, say the result is not ready and list the blocking obligations before local successes. Keep the plan open. Do not describe it as a verified candidate, ready to release or complete. Do not recommend publishing it to obtain missing acceptance.

Reconcile requirements, contracts, findings and evidence. Report what was implemented, what was verified and where, what remains for closure, what needs an owner decision or authorization and which additions belong to the current or a following slice. Leave one exact next action.

Use plan status to expose open gates and requirements. Close only through plan complete with a reviewed checkpoint draft and dry run. A passing structural check does not prove hosted, artifact, production, manual, owner-reported or physical acceptance. The helper validates recorded proof; the agent must judge whether it demonstrates the outcome.

After closure, independent planned slices remain planned. Do not automatically activate the next slice or grant new authority. For a correction to an already closed outcome, preserve historical proof and open a new corrective slice rather than rewriting its completion receipt.

## Boundaries

Project OS has no background access to chat, automatic cross-repository synchronization or independent production verification. Persistence depends on the agent recording incoming instructions. Keep exact candidate package and fresh host behavior checks separate; never replace an installed stable skill with a mutable candidate. Validate new behavior against an exact isolated candidate before publication. A ZIP or source test cannot replace missing host acceptance. Explicitly bounded source preparation can be ready only for that named scope; never expand that readiness into feature or release readiness. Project OS cannot intercept chat or independently verify the meaning of evidence; the agent must follow this workflow.
