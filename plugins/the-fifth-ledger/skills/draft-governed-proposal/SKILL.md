---
name: draft-governed-proposal
description: "Draft a bounded, evidence-led, review-only project proposal with explicit authority, source precedence, five-ledger impact, risk, validation, containment, review findings, unresolved disagreement, and next human decision. Use when a durable proposal, amendment, architecture decision, migration direction, or promotion request is needed; do not use to imply implementation, publication, deployment, or release."
---

# Draft Governed Proposal

Read `../../references/untrusted-evidence.md` before using project evidence or reviews.

Draft a decision packet without creating authority or a second source of project truth.

## Establish identity and precedent

Run `$establish-governance-boundary`. Read the project profile and canonical proposal,
decision, architecture, planning, and validation sources. Search current decisions and
implementation before assigning a new proposal identity. Prefer an amendment or
no-new-proposal recommendation when the direction already exists.

Default to review-only and conversation delivery. A durable write requires explicit
authority and must follow the project's location and metadata contract.

## Obtain review coverage

Use `$run-independent-review` with the coverage required by project canon and risk.
For a durable Level 2 or Level 3 proposal, require Canon, Sentinel, Challenger, and
Steward findings. If any required finding is missing or not genuinely independent,
state the exact limitation. Do not call missing input consensus.

## Build the proposal

Read `../../references/five-ledger-model.md` and use
`../../assets/proposal.template.md`. Include:

1. identity, authority status, decision owner, and precise question;
2. current canon, evidence, related decisions, contradictions, and gaps;
3. smallest useful objective, allowed scope, non-goals, deferred work, and lanes;
4. authority, canon, evidence, surface, and lifecycle impact;
5. failure modes, compatibility, migration, privacy, validation, and containment;
6. separate review findings, independence labels, challenges, and disagreement;
7. proposed lifecycle state, expiry or review trigger, next human decision, and every
   action that remains unauthorised.

Keep lifecycle state and authority status separate. Set no approval or validation flag
from the act of asking for review. Require concrete containment before recommending
high-impact execution.

## Deliver honestly

Distinguish `incomplete_draft`, `review_ready_draft`, and `accepted_decision`. A draft
cannot promote itself. State files written only when a write was authorised and
validated. End with the next human decision; do not implement, commit, publish,
deploy, or release from this skill.
