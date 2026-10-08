# The Five-Ledger Model

Treat coherence as an evidence-backed relationship among five ledgers. The ledgers
are views of project truth, not new authority sources.

## 1. Authority ledger

Record who requested the work, the requested outcome, permitted action level, target,
explicit exclusions, and decisions still reserved for a human or external authority.

Never infer a write, commit, publication, deployment, communication, destructive
action, or release from permission to answer, inspect, review, or propose.

## 2. Canon ledger

Identify the sources that own product behavior, architecture, policy, terminology,
plans, decisions, and release state. Record precedence when sources conflict.

The plugin must route to project canon; it must not reproduce canon as shadow policy.

## 3. Evidence ledger

Bind every material claim to the exact artifact, identity, command, observation,
timestamp, and result that supports it. Distinguish `confirmed`, `contradicted`,
`incomplete`, and `unavailable`.

When no valid repository identity exists, use a deterministic traversal observation of
a trusted, quiescent filesystem tree and label its scope and assurance boundary. Explicit
exclusions make the identity bounded and cannot prove complete represented-tree or
metadata parity. A complete scope still covers only the fields declared by the
algorithms; matching sequential traversals are not an atomic filesystem snapshot. Treat
validators as potential writers and preserve any detected side effect in the evidence
record.

Intent, a passing sample, an old report, or a request to validate is not validation.

## 4. Surface ledger

Track the outward representations of project truth: runtime behavior, APIs, schemas,
UI, documentation, support text, generated artifacts, dashboards, reports, and
release material. A surface may summarize canon but must not invent behavior.

## 5. Lifecycle ledger

Keep proposal, review, decision, implementation, validation, merge, publication,
deployment, observation, promotion, release, supersession, and archival states
distinct. A later state requires its own evidence and authority.

Keep candidate version, published artifact, provider validation, and human release
decision distinct. Matching labels or configured workflows do not collapse these gates.

## Coherence rule

Call the project coherent only when relevant claims across all five ledgers agree for
the same identity and time boundary. Preserve contradictions and unresolved gaps.
Never repair missing evidence with narrative.

## Proportional governance

Apply only the governance needed for the risk:

- **Level 0 — answer:** no mutation; inspect only what the answer requires.
- **Level 1 — reversible local work:** bounded files, explicit validation, no external effect.
- **Level 2 — cross-surface or public work:** reconcile canon, evidence, documentation, compatibility, and rollback.
- **Level 3 — external, irreversible, privileged, deployment, or release work:** require exact authority, identity-bound evidence, independent controls where available, and a human decision at the declared gate.

Escalate when uncertainty increases risk. Do not impose Level 3 ceremony on Level 0
or Level 1 work.
