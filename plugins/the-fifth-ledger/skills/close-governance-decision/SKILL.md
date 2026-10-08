---
name: close-governance-decision
description: "Reconcile an explicitly decided project proposal or governance transition across decision records, canonical sources, agent guidance, private continuity, implementation, validation, documentation, deployment, and release claims. Use after a human approves, rejects, narrows, supersedes, implements, publishes, promotes, or releases a governed decision; do not use to invent evidence or perform unauthorised work."
---

# Close Governance Decision

Read `../../references/untrusted-evidence.md` before reconciling decision evidence.

Reconcile one authorised transition without rewriting history.

## Prove the decision and present state

Run `$establish-governance-boundary`. Record the decision identity, prior state, exact
human decision, requested resulting state, decision owner, and implementation,
validation, merge, publication, deployment, observation, and release evidence that
actually exists.

A decision grants only its stated authority. It does not manufacture completed work or
evidence. Keep lifecycle state, authority, and archival classification distinct.

## Review the transition

Read the project profile, canonical proposal and decision records, affected source,
tests, documentation, and release evidence required by the transition. Use
`$run-independent-review` when project canon or Level 2/3 risk requires multiple
lenses. Missing required findings make the closeout incomplete.

## Build the continuity matrix

Use `../../assets/closeout.template.md`. Classify every applicable surface as:

- `update`;
- `unchanged`;
- `deferred`;
- `not_applicable`.

Cover proposal and decision history, canon, agent guidance, local/private continuity,
runtime or product artifacts, tests, public documentation, deployment records, and
release records. Preserve historical states and public/private lanes. Write only
compact verified durable truth; never turn draft speculation into memory or canon.

## Apply only authorised reconciliation

Default to a chat-only closeout and proposed patch list. When durable closeout writes
are expressly authorised, edit only declared surfaces, keep changes unstaged unless
staging is requested, and do not hide new implementation inside governance cleanup.

Validate metadata and links, reread changed files, compare pre/post repository state,
run checks required by changed surfaces, and confirm no private evidence crossed into
public output. Report only validation actually executed.

Return the decision identity, supported resulting state, review coverage, continuity
matrix, files changed, validation, contradictions, residual risk, remaining
unauthorised actions, and next human decision or `none`.
