param(
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$features = @(
    [pscustomobject]@{ feature = 'Local model inventory and documentation'; maturity = 'Implemented'; evidence = 'Reads local PBIP/TMDL/DAX/Power Query/model metadata.'; primaryScripts = @('Get-PowerBIInventory.ps1','New-PowerBIModelSummary.ps1','New-PowerBIMetricCatalog.ps1') },
    [pscustomobject]@{ feature = 'Live Desktop review'; maturity = 'ImplementedWhenDesktopAvailable'; evidence = 'Uses local XMLA/ADOMD endpoint and returns unavailable status when Desktop/provider is missing.'; primaryScripts = @('Get-PowerBIDesktopLiveConnection.ps1','Invoke-PowerBILiveDmv.ps1','Invoke-PowerBILiveAutoReview.ps1') },
    [pscustomobject]@{ feature = 'Fabric workspace inventory'; maturity = 'LiveReadOrSnapshot'; evidence = 'Uses GET-only token-file REST reads when -UseRest/-AccessTokenPath are provided, or local snapshots otherwise.'; primaryScripts = @('Get-PowerBIFabricWorkspaceInventory.ps1','Import-PowerBIFabricWorkspaceSnapshot.ps1') },
    [pscustomobject]@{ feature = 'Fabric governance/executive QA'; maturity = 'SnapshotBacked'; evidence = 'Runs on live-imported or fixture snapshots; no Fabric mutation.'; primaryScripts = @('New-PowerBIFabricPortfolioCommandCenter.ps1','New-PowerBIFabricExecutiveWarRoom.ps1') },
    [pscustomobject]@{ feature = 'PBIP authoring'; maturity = 'DraftAndApply'; evidence = 'Creates draft artifacts and applies only to PBIP text files with explicit -Apply.'; primaryScripts = @('New-PowerBIMeasureDraft.ps1','Apply-PowerBIPBIPMeasureDraft.ps1','Add-PowerBIPBIPReportPage.ps1') },
    [pscustomobject]@{ feature = 'Report render readiness'; maturity = 'MetadataPlusOptionalScreenshot'; evidence = 'Checks PBIP report JSON and optional screenshot evidence; automated publish remains disabled.'; primaryScripts = @('Test-PowerBIReportRenderReadiness.ps1','New-PowerBIReportScreenshotUXReview.ps1') },
    [pscustomobject]@{ feature = 'RLS leakage validation'; maturity = 'DraftWithOptionalLiveQuery'; evidence = 'Builds role-level DAX tests and can execute live count queries when -CheckLive is supplied.'; primaryScripts = @('Test-PowerBIRlsLeakage.ps1','New-PowerBIRlsTrustReview.ps1') },
    [pscustomobject]@{ feature = 'Decision, capacity, and promotion simulation'; maturity = 'HeuristicSimulation'; evidence = 'Ranks risks from available metadata/snapshots; does not mutate service state.'; primaryScripts = @('New-PowerBIReportDecisionSimulator.ps1','New-PowerBIFabricPromotionRiskSimulator.ps1','New-PowerBICapacityMitigationPlanner.ps1') },
    [pscustomobject]@{ feature = 'Semantic fixtures'; maturity = 'SyntheticTestData'; evidence = 'Generates deterministic expectations and fixtures for later validation.'; primaryScripts = @('New-PowerBISemanticTestFixtureGenerator.ps1','Invoke-PowerBISemanticTestRunner.ps1') }
)

$result = [pscustomobject]@{
    schema = 'codex.powerbi.featureMaturityMap.v1'
    generated = (Get-Date).ToString('s')
    featureCount = $features.Count
    features = $features
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @('# Power BI Feature Maturity Map', '')
foreach ($feature in $features) {
    $lines += "## $($feature.feature)"
    $lines += "- Maturity: $($feature.maturity)"
    $lines += "- Evidence: $($feature.evidence)"
    $lines += "- Scripts: $(@($feature.primaryScripts) -join ', ')"
    $lines += ''
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
