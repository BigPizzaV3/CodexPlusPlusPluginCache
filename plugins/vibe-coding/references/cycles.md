# Workflow cycles

Choose stages from the requested outcome. A straightforward fix needs neither a preliminary map nor a separate plan. Work stays in the current conversation; separate tasks and delegation are not implied.

| Situation | Useful sequence | Completion condition |
|---|---|---|
| Early idea needing a plan | Task Shaping → Validation & Clarification if needed | Outcome, constraints and acceptance are clear |
| Unfamiliar repository | Project Atlas → a relevant detailed map | Needed areas and relationships are evidenced |
| Unclear defect | Domain audit → implementation when requested → verification | Cause is supported and requested behavior verified |
| Known bug | Domain implementation → relevant check | The affected contract is coherently fixed |
| One new bug | Probe → verification of the changed area | One area has an evidenced outcome |
| Several reports | Evidence Normalization → Synthesis | Duplicates and contradictions are resolved |
| Patch review | Review → authorized fixes → relevant recheck | No known defect or unverified required gate remains in scope |
| Stale maps | Map Staleness Check → authorized Map Refresh | Affected entries updated with stable IDs |
| Complex runtime contract | Domain implementation → corresponding check | Relevant failure, retry and recovery paths verified |
| Iteration closure | Iteration Closure | Done / next slice / replan / blocked |

Carry only relevant context between stages: objective, boundary, rule and owner, evidence, intended behavior, changes, verification and unresolved limits. Distinguish observations from hypotheses. A plan or stale map alone does not prove a defect.

Repeat verification when a new change or new evidence justifies it. Stop on completed scope, a concrete external gate or lack of meaningful progress; do not cycle indefinitely.
