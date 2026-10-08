param(
    [string]$Path = ".",
    [string]$OutputDirectory = "powerbi-auto-review"
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

$outputs = [ordered]@{}
$outputs.Environment = (& (Join-Path $scriptRoot 'Test-PowerBIEnvironment.ps1') -Json | ConvertFrom-Json)
$outputs.InventoryPath = Join-Path $resolvedOut 'inventory.json'
$outputs.PbipStructurePath = Join-Path $resolvedOut 'pbip-structure.md'
$outputs.InsightScanPath = Join-Path $resolvedOut 'insight-scan.md'
$outputs.MetricCatalogPath = Join-Path $resolvedOut 'metric-catalog.md'
$outputs.DependencyGraphPath = Join-Path $resolvedOut 'dependency-graph.md'
$outputs.DependencyGraphMermaidPath = Join-Path $resolvedOut 'dependency-graph.mmd'
$outputs.RefactorPlanPath = Join-Path $resolvedOut 'refactor-plan.md'
$outputs.ReportBlueprintPath = Join-Path $resolvedOut 'report-blueprint.md'
$outputs.ModelSummaryPath = Join-Path $resolvedOut 'model-summary.md'
$outputs.ExecutiveNarrativePath = Join-Path $resolvedOut 'executive-narrative.md'
$outputs.AIPackDirectory = Join-Path $resolvedOut 'ai-pack'
$outputs.InnovationReviewDirectory = Join-Path $resolvedOut 'innovation-review'
$outputs.ExternalToolsReviewDirectory = Join-Path $resolvedOut 'external-tools-review'
$outputs.NativeToolParityReviewDirectory = Join-Path $resolvedOut 'native-tool-parity-review'
$outputs.RealFeatureReviewDirectory = Join-Path $resolvedOut 'real-feature-review'

& (Join-Path $scriptRoot 'Get-PowerBIInventory.ps1') -Path $Path -Json | Set-Content -LiteralPath $outputs.InventoryPath -Encoding UTF8
& (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -OutputPath $outputs.PbipStructurePath | Out-Null
& (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -OutputPath $outputs.InsightScanPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -OutputPath $outputs.MetricCatalogPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -OutputPath $outputs.DependencyGraphPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -Mermaid -OutputPath $outputs.DependencyGraphMermaidPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIRefactorPlan.ps1') -Path $Path -OutputPath $outputs.RefactorPlanPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIReportBlueprint.ps1') -Path $Path -OutputPath $outputs.ReportBlueprintPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIModelSummary.ps1') -Path $Path -OutputPath $outputs.ModelSummaryPath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIExecutiveNarrative.ps1') -Path $Path -OutputPath $outputs.ExecutiveNarrativePath | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIAIPromptPack.ps1') -Path $Path -OutputDirectory $outputs.AIPackDirectory | Out-Null
& (Join-Path $scriptRoot 'Invoke-PowerBIInnovationReview.ps1') -Path $Path -OutputDirectory $outputs.InnovationReviewDirectory | Out-Null
& (Join-Path $scriptRoot 'Invoke-PowerBIExternalToolsReview.ps1') -Path $Path -OutputDirectory $outputs.ExternalToolsReviewDirectory | Out-Null
& (Join-Path $scriptRoot 'Invoke-PowerBINativeToolParityReview.ps1') -Path $Path -OutputDirectory $outputs.NativeToolParityReviewDirectory | Out-Null
& (Join-Path $scriptRoot 'Invoke-PowerBIRealFeatureReview.ps1') -Path $Path -OutputDirectory $outputs.RealFeatureReviewDirectory | Out-Null

$index = New-Object System.Collections.Generic.List[string]
$index.Add('# Power BI Auto Review')
$index.Add('')
$index.Add(('Source: `{0}`' -f (Resolve-Path -LiteralPath $Path).Path))
$index.Add(('Generated: {0}' -f (Get-Date).ToString('s')))
$index.Add('')
$index.Add('## Artifacts')
$index.Add('')
foreach ($entry in $outputs.GetEnumerator()) {
    if ($entry.Key -eq 'Environment') { continue }
    $index.Add(('- {0}: `{1}`' -f $entry.Key, $entry.Value))
}
$index.Add('')
$index.Add('## Environment')
$index.Add('')
foreach ($prop in $outputs.Environment.PSObject.Properties) {
    $index.Add(('- {0}: {1}' -f $prop.Name, ($(if ($prop.Value) { $prop.Value } else { 'not found' }))))
}

$indexPath = Join-Path $resolvedOut 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

[pscustomobject]@{
    OutputDirectory = $resolvedOut
    Index = $indexPath
}
