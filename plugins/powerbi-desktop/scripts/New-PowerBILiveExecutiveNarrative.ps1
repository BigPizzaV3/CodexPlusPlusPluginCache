param(
    [string]$Server,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$scan = & (Join-Path $PSScriptRoot 'Invoke-PowerBILiveInsightScan.ps1') -Server $Server -Json | ConvertFrom-Json
$graph = & (Join-Path $PSScriptRoot 'New-PowerBILiveDependencyGraph.ps1') -Server $Server -Json | ConvertFrom-Json

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Executive Narrative')
$lines.Add('')
$lines.Add(('The open Power BI Desktop model is rated **{0}** risk with score **{1}**.' -f $scan.riskLevel, $scan.riskScore))
$lines.Add(('The live model contains **{0}** tables, **{1}** measures, **{2}** relationships, and **{3}** measure dependencies.' -f $scan.tableCount, $scan.measureCount, $scan.relationshipCount, $scan.dependencyEdgeCount))
$lines.Add('')
$lines.Add('## Most Important Signals')
$lines.Add('')
foreach ($finding in @($scan.findings | Select-Object -First 8)) {
    $lines.Add(('- **{0}** on `{1}`: {2}' -f $finding.Title, $finding.Source, $finding.Detail))
}
$lines.Add('')
$lines.Add('## Highest-Impact Measures')
$lines.Add('')
foreach ($hub in @($graph.hubMetrics | Select-Object -First 8)) {
    $lines.Add(('- `{0}`: hub score {1}, incoming {2}, outgoing {3}' -f $hub.name, $hub.hubScore, $hub.incoming, $hub.outgoing))
}
$lines.Add('')
$lines.Add('## First Actions')
$lines.Add('')
$lines.Add('- Add descriptions and owners to business-critical measures.')
$lines.Add('- Review high-risk DAX patterns before changing visuals.')
$lines.Add('- Validate hub measures before publishing because downstream metrics may change.')

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
