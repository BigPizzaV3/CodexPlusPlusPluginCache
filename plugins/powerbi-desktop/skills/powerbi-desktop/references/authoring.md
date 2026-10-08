# Authoring And Validation

Use PBIP/TMDL only. Do not write binary PBIX/PBIT files.

- `New-PowerBIMeasureDraft.ps1` and `New-PowerBICalculatedColumnDraft.ps1` create safe semantic-model drafts.
- `New-PowerBIPowerQueryDraft.ps1`, `New-PowerBIReportPageDraft.ps1`, and `New-PowerBIVisualDraft.ps1` create query or report drafts.
- `Apply-PowerBIPBIPMeasureDraft.ps1`, `Apply-PowerBIPBIPCalculatedColumnDraft.ps1`, `Apply-PowerBIPBIPPowerQueryDraft.ps1`, and `Apply-PowerBIPBIPTmdlDraft.ps1` require an explicit apply action.
- `Invoke-PowerBIPBIPApplyPlan.ps1` summarizes applied artifacts and rollback guidance.

Before applying: identify the target asset, show the proposed change, explain dependencies and rollback, and get the user's authorization. After applying: validate in Power BI Desktop and run relevant semantic checks.
