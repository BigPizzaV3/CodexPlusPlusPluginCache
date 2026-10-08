---
name: powerbi-model-wizard
description: "Use when starting a new Power BI model from a business goal, source list, star schema, KPI plan, security plan, and report-page plan."
---

# Power BI Model Wizard

Use `New-PowerBIModelWizard.ps1` to create a local design pack for a new Power BI model from any Power BI Desktop connector. It directly profiles local CSV/JSON files; for every other connector, use `templates/powerbi-data-sources.example.json` with the exact connector name shown in Power BI Desktop. It proposes facts, dimensions, KPI drafts, source drafts, and report pages. It does not create a PBIX/PBIT binary, connect credentials, or publish.

1. Gather the business decision and either local CSV/JSON source paths or a connector declaration file. Ask only for domain rules that cannot be inferred, such as KPI ownership or RLS roles.
2. Generate the draft directory with `-DataSourcePaths <paths> -Initialize` or `-DataSourceConfigPath <config> -Initialize`.
3. Review data-contract and measure drafts with the user.
4. Have the user create and save the target PBIP in Power BI Desktop.
5. Generate and explicitly apply reviewed PBIP/TMDL drafts, then validate with `Invoke-PowerBIUnifiedReview.ps1`.

State clearly that the generated content is a draft until it has been reviewed and validated in Power BI Desktop.
