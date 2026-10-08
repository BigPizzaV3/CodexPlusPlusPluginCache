# Review Lenses

Use configurable lenses rather than project-specific personalities.

- **Canon:** source hierarchy, product meaning, architecture, documentation, and cross-surface coherence.
- **Sentinel:** runtime, security, safety, privacy, compatibility, migration, rollback, and release risk.
- **Challenger:** bounded alternatives, reversibility, scope reduction, and rejected trade-offs.
- **Steward:** lifecycle integrity, decision ownership, evidence quality, maintenance cost, and governance weight.

Each finding must state the bounded artifact reviewed, sources, assumptions,
confidence, blockers, and what would change the conclusion.

## Independence labels

- `independent`: produced in a separate context without prior findings or expected conclusions.
- `role-separated`: produced as a distinct lens in a shared context.
- `unavailable`: the required lens or isolation could not be obtained.

Never label shared-context role-play as independent. Preserve initial findings before
synthesis. Record challenges, responses, and unresolved disagreement; do not vote.
