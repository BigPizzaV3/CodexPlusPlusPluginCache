# Output format

Keep the standard response compact. For each selected candidate use:

```markdown
## Idea N — Name

One-sentence overview.

### Concept

What it is and how it works in a short paragraph.

### Why it is interesting

The value or novelty created by the combination.

### DNA

- Target ← Parent A
- Technology ← Parent B
- Purpose ← Mutation: ...
- Constraint/Lock ← Preserved: ...
```

List only the most informative lineage items. Identify inferred parents as “inferred material”; do not imply the user supplied them.

Do not show private candidate pools, discarded candidates, detailed scoring, or chain-of-thought. If evaluation is requested, add a compact table with Novelty, Usefulness, Feasibility, Theme fit, and one short selection reason per idea.

For iterative requests, optionally prefix one line such as `Generation 2 — parents: Idea 2 × Idea 5; Target locked`. Do not repeat the entire prior output.
