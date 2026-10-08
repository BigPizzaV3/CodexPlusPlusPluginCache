# Generation rules

## 1. Parse the request

Extract:

| Field | Default | Rule |
|---|---:|---|
| Theme | conversation/request | May contain several themes |
| Constraints | none | Hard invariants unless stated as preferences |
| Sources | inferred parents | User sources take priority |
| Mutation | Medium / 50 | Accept Low, Medium, High, or 0–100 |
| Count | 5 | Build a larger private pool |
| Locks | none | Bind a DNA locus or condition across generations |

Use relevant visible conversation context when the request says “this project”, “these”, or otherwise clearly refers back. Separate observed facts from inferred parent material.

## 2. Build Idea DNA

Choose loci that explain each parent. Typical loci are Subject, Target, Action/Function, Purpose, Method/Technology, Characteristic, Constraint, Context, and Value. Adapt the schema when domain-specific loci are more informative, such as interaction model, business model, physical form, narrative role, research method, or input/output.

For sentence-like ideas, grammatical subject, predicate, object, and modifiers may help extraction, but convert them into idea-relevant loci before crossing.

Keep locks attached to exact loci. Represent hard constraints separately so they apply to every candidate.

## 3. Select heterogeneous parents

When sources are supplied, decompose each and cross across sources. When absent, infer at least two parents with different mechanisms or contexts—not synonyms of the theme. A parent may be a known pattern, domain mechanism, user-provided project component, or an explicitly invented material candidate. Label invented/inferred material honestly.

## 4. Transform

For every candidate, record a compact private lineage map:

- inherited locus ← Parent A or B
- replaced locus ← another parent
- mutated locus ← named mutation
- locked locus ← unchanged

Use one or more operators:

- Crossover: exchange one or more loci between parents.
- Substitution: replace one locus with a distant but functional analogue.
- Context shift: move the mechanism into another situation or user group.
- Inversion: reverse actor, flow, ownership, timing, or incentive.
- Scale shift: move between personal, household, community, or infrastructure scale.
- Constraint-induced mutation: reinterpret within hard limits, never break them.

At least one material locus must change. Cosmetic renaming is not a transformation.

## 5. Interpret before rejecting

Turn the transformed DNA into a coherent mechanism. Ask at result level: who uses it, what happens, why the crossed parts depend on each other, and what value appears only because of the combination. Keep productive tension; remove arbitrary decoration.

## 6. Evaluate and select

Score privately on Novelty, Usefulness, Feasibility, and Theme fit. Remove invariant violations first. Then select for quality and diversity, avoiding five variants of one mechanism. Show scores or selection reasons only on request.
