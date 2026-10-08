param(
    [string]$Path = ".",
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scan = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$graph = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -Json | ConvertFrom-Json

$reviewMetrics = @($catalog.metrics | Where-Object { $_.riskLevel -eq 'review' })
$topFindings = @($scan.Findings | Select-Object -First 3)
$hubMetrics = @($graph.hubMetrics | Where-Object { $_.hubScore -gt 0 } | Select-Object -First 3)

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Executive Narrative')
$lines.Add('')
$lines.Add(('This report is currently rated **{0}** risk with a score of **{1}**.' -f $scan.RiskLevel, $scan.RiskScore))
$lines.Add(('The scan found **{0}** metrics, **{1}** Power Query file(s), and **{2}** prioritized finding(s).' -f $catalog.metricCount, $scan.QueryCount, @($scan.Findings).Count))
$lines.Add('')
$lines.Add('## What Matters')
$lines.Add('')
if ($topFindings.Count -gt 0) {
    foreach ($finding in $topFindings) {
        $lines.Add(('- **{0}**: {1}' -f $finding.Title, $finding.Detail))
    }
}
else {
    $lines.Add('- No major heuristic findings were detected.')
}
$lines.Add('')
$lines.Add('## Metrics Needing Sign-Off')
$lines.Add('')
if ($reviewMetrics.Count -gt 0) {
    foreach ($metric in $reviewMetrics) {
        $lines.Add(('- `{0}` from `{1}` needs owner and definition review. Risks: {2}' -f $metric.name, $metric.source, ($metric.risks -join '; ')))
    }
}
else {
    $lines.Add('- No metrics were flagged for review by the current heuristics.')
}
$lines.Add('')
$lines.Add('## Dependency Impact')
$lines.Add('')
if ($hubMetrics.Count -gt 0) {
    foreach ($metric in $hubMetrics) {
        $lines.Add(('- `{0}` has dependency hub score {1}; validate downstream impact before changing it.' -f $metric.name, $metric.hubScore))
    }
}
else {
    $lines.Add('- No measure dependency hubs were detected.')
}
$lines.Add('')
$lines.Add('## First Actions')
$lines.Add('')
$lines.Add('- Export or maintain the project as PBIP/TMDL before structural changes.')
$lines.Add('- Assign owners and business definitions for every metric marked for review.')
$lines.Add('- Validate DAX changes in Power BI Desktop and, where available, DAX Studio or Tabular Editor.')

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
}
$content
