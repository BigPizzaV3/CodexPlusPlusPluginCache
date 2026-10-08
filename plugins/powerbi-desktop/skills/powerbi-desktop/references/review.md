# Review Workflow

Use these variants after the primary route in `SKILL.md` is chosen.

- `Invoke-PowerBIInsightScan.ps1`: focused DAX, Power Query, and source-control triage.
- `New-PowerBIMetricCatalog.ps1`: KPI definitions and ownership placeholders.
- `New-PowerBIDependencyGraph.ps1`: impact analysis before changing shared measures.
- `New-PowerBIExecutiveNarrative.ps1`: stakeholder-friendly local narrative.
- `Invoke-PowerBIUnifiedReview.ps1`: local review plus optional live Desktop and external-tool information.
- `Invoke-PowerBILiveAutoReview.ps1`: read-only review of the open Desktop model.

Treat heuristic findings as prioritization signals. Confirm important business logic against the model source or a live query.
