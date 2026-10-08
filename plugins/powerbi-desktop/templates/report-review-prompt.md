# Power BI Report Review Prompt

Use this prompt after running the local inventory, model summary, and insight scan.

## Context To Provide

- `powerbi-inventory` output
- `powerbi-model-summary.md`
- `powerbi-insight-scan.md`
- Any exported screenshots or user journeys
- Business objective and refresh cadence

## Review Request

Review this Power BI report as a governed analytics product. Prioritize:

1. Semantic model clarity
2. DAX correctness and maintainability
3. Power Query refresh reliability
4. Report UX and visual density
5. Source-control readiness
6. Risky dependencies, hard-coded paths, volatile logic, and ambiguous metrics

Return:

- Top risks in priority order
- Business questions the report appears to answer
- Metric glossary candidates
- Refactoring plan split into safe, medium-risk, and high-risk changes
- Validation checklist for Power BI Desktop, Tabular Editor, and DAX Studio
