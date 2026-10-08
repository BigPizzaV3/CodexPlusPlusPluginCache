param(
    [string]$Server,
    [string]$OutputDirectory = "powerbi-live-auto-review"
)

$ErrorActionPreference = 'Stop'

$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null

$paths = [ordered]@{
    LiveConnection = Join-Path $out 'live-connection.json'
    LiveModelSummary = Join-Path $out 'live-model-summary.md'
    LiveMetricCatalog = Join-Path $out 'live-metric-catalog.md'
    LiveMetricCatalogJson = Join-Path $out 'live-metric-catalog.json'
    LiveDependencyGraph = Join-Path $out 'live-dependency-graph.md'
    LiveDependencyGraphMermaid = Join-Path $out 'live-dependency-graph.mmd'
    LiveInsightScan = Join-Path $out 'live-insight-scan.md'
    LiveInsightScanJson = Join-Path $out 'live-insight-scan.json'
    LiveMeasureValidation = Join-Path $out 'live-measure-validation.md'
    LiveMeasureValidationJson = Join-Path $out 'live-measure-validation.json'
    LiveMetadataGovernance = Join-Path $out 'live-metadata-governance.md'
    LiveRefactorSuggestions = Join-Path $out 'live-refactor-suggestions.md'
    LiveFixBacklog = Join-Path $out 'live-fix-backlog.md'
    LiveDaxFixDrafts = Join-Path $out 'live-dax-fix-drafts.md'
    LiveExecutiveNarrative = Join-Path $out 'live-executive-narrative.md'
}

& (Join-Path $PSScriptRoot 'Get-PowerBIDesktopLiveConnection.ps1') -Json | Set-Content -LiteralPath $paths.LiveConnection -Encoding UTF8
& (Join-Path $PSScriptRoot 'Get-PowerBILiveModelSummary.ps1') -Server $Server -OutputPath $paths.LiveModelSummary | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1') -Server $Server -OutputPath $paths.LiveMetricCatalog | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1') -Server $Server -Json -OutputPath $paths.LiveMetricCatalogJson | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveDependencyGraph.ps1') -Server $Server -OutputPath $paths.LiveDependencyGraph | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveDependencyGraph.ps1') -Server $Server -Mermaid -OutputPath $paths.LiveDependencyGraphMermaid | Out-Null
& (Join-Path $PSScriptRoot 'Invoke-PowerBILiveInsightScan.ps1') -Server $Server -OutputPath $paths.LiveInsightScan | Out-Null
& (Join-Path $PSScriptRoot 'Invoke-PowerBILiveInsightScan.ps1') -Server $Server -Json -OutputPath $paths.LiveInsightScanJson | Out-Null
& (Join-Path $PSScriptRoot 'Test-PowerBILiveMeasures.ps1') -Server $Server -Top 25 -OutputPath $paths.LiveMeasureValidation | Out-Null
& (Join-Path $PSScriptRoot 'Test-PowerBILiveMeasures.ps1') -Server $Server -Top 25 -Json -OutputPath $paths.LiveMeasureValidationJson | Out-Null
& (Join-Path $PSScriptRoot 'Test-PowerBILiveMetadataGovernance.ps1') -Server $Server -OutputPath $paths.LiveMetadataGovernance | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveRefactorSuggestions.ps1') -Server $Server -OutputPath $paths.LiveRefactorSuggestions | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveFixBacklog.ps1') -Server $Server -OutputPath $paths.LiveFixBacklog | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveDaxFixDrafts.ps1') -Server $Server -OutputPath $paths.LiveDaxFixDrafts | Out-Null
& (Join-Path $PSScriptRoot 'New-PowerBILiveExecutiveNarrative.ps1') -Server $Server -OutputPath $paths.LiveExecutiveNarrative | Out-Null

$index = New-Object System.Collections.Generic.List[string]
$index.Add('# Power BI Live Auto Review')
$index.Add('')
$index.Add(('Generated: {0}' -f (Get-Date).ToString('s')))
$index.Add('')
$index.Add('## Artifacts')
$index.Add('')
foreach ($entry in $paths.GetEnumerator()) {
    $index.Add(('- {0}: `{1}`' -f $entry.Key, $entry.Value))
}
$indexPath = Join-Path $out 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

[pscustomobject]@{
    OutputDirectory = $out
    Index = $indexPath
}
