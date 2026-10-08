# Release Workflow

Start with `New-PowerBIReleaseCandidatePack.ps1 -Path .\your-model -OutputDirectory .\powerbi-release-candidate`.

- Add `-IncludeAnalyticalQa` when business methodology or KPI changes need a stakeholder-ready explanation.
- Add `-IncludeAdvancedUspQa` when evidence graphs, contract testing, RLS, freshness, or UX risk matter.
- Use Fabric snapshots for repeatable evidence. Live Fabric access is token-file and GET-only.
- Use `Invoke-PowerBISemanticTestRunner.ps1` before a release when semantic expectations are available.

Report a release gate as decision support, not a substitute for business-owner sign-off. Clearly separate live proof, snapshot evidence, local findings, and unresolved assumptions.
