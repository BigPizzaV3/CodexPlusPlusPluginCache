---
name: review-project-coherence
description: "Review a project, proposal, change, or claim for contradictions across authority, canonical sources, evidence, runtime and user-facing surfaces, and lifecycle status. Use when documentation may drift from implementation, status claims may exceed evidence, multiple truth sources disagree, or a maintainer needs a five-ledger coherence verdict without implied mutation authority."
---

# Review Project Coherence

Read `../../references/untrusted-evidence.md` before inspecting any claimed source.

Reconcile claims, not prose alone. Default to read-only assessment.

## Establish the review frame

Run `$establish-governance-boundary` when the target or action level is not already
proved. Read `../../references/five-ledger-model.md`, the project profile when present,
and only the canonical sources needed for the bounded question.

Record the artifact, exact identity, time boundary, decision question, authorised
scope, and surfaces not reviewed.

## Build a claim inventory

For each material claim, record:

- ledger and surface;
- source and owner;
- exact supporting evidence;
- identity and freshness;
- status: `confirmed`, `contradicted`, `incomplete`, or `unavailable`;
- downstream surfaces affected by drift.

Check for:

- action beyond granted authority;
- duplicate or conflicting canonical sources;
- conclusions based on requests, intent, stale reports, or mixed identities;
- runtime, API, schema, UI, generated artifacts, docs, or public copy reconstructing
  truth they do not own;
- lifecycle promotion without implementation, validation, merge, publication,
  deployment, observation, or release evidence.

Do not repair a contradiction by choosing the most convenient source. Apply declared
precedence or request a human decision.

## Scale the review

For Level 0 or Level 1 work, return a direct ledger comparison. For Level 2 or Level 3
work with competing concerns, use `$run-independent-review`. Label unavailable review
coverage honestly.

## Return the verdict

Use one of:

- `coherent`;
- `coherent_with_explicit_gaps`;
- `review_required`;
- `blocked_by_authority`;
- `unverifiable`.

Return the identity, ledger table, contradictions, evidence gaps, affected surfaces,
supported claims, unsupported claims, residual risk, and next decision. Do not edit,
approve, publish, deploy, or release unless separately authorised.
