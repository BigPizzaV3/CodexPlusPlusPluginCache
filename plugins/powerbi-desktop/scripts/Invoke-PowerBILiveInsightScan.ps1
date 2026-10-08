param(
    [string]$Server,
    [string]$OutputPath,
    [string]$RulesPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

if (-not $RulesPath) {
    $RulesPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'rules/powerbi-governance-rules.json'
}
$rules = Get-Content -Raw -LiteralPath $RulesPath | ConvertFrom-Json

$catalogScript = Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1'
$graphScript = Join-Path $PSScriptRoot 'New-PowerBILiveDependencyGraph.ps1'
$summaryScript = Join-Path $PSScriptRoot 'Get-PowerBILiveModelSummary.ps1'

$catalog = & $catalogScript -Server $Server -Json | ConvertFrom-Json
$graph = & $graphScript -Server $Server -Json | ConvertFrom-Json
$summary = & $summaryScript -Server $Server -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
function Add-Finding {
    param([string]$Severity, [string]$Category, [string]$Title, [string]$Detail, [string]$Source)
    $score = switch ($Severity) { 'High' { 3 } 'Medium' { 2 } 'Low' { 1 } default { 0 } }
    $findings.Add([pscustomobject]@{ Severity = $Severity; Score = $score; Category = $Category; Title = $Title; Detail = $Detail; Source = $Source })
}

foreach ($metric in @($catalog.metrics)) {
    foreach ($risk in @($metric.risks)) {
        $severity = if ($risk -match 'correctness|performance') { 'High' } elseif ($risk -match 'determinism|maintainability') { 'Medium' } else { 'Low' }
        Add-Finding -Severity $severity -Category 'Measure Risk' -Title $risk -Detail ('Review measure `{0}` in table `{1}`.' -f $metric.name, $metric.table) -Source $metric.name
    }
    if (-not $metric.description) {
        Add-Finding -Severity 'Low' -Category 'Metric Governance' -Title 'Missing measure description' -Detail 'Measure has no model description. Add a business definition for governed use.' -Source $metric.name
    }
}

$localDateTables = @($summary.tables | Where-Object { $_.Name -like 'LocalDateTable_*' })
if ($localDateTables.Count -gt 5) {
    Add-Finding -Severity 'Medium' -Category 'Model Design' -Title 'Many auto date tables' -Detail ("Detected {0} hidden LocalDateTable objects. Consider a governed date table and disabling auto date/time." -f $localDateTables.Count) -Source 'model'
}

foreach ($hub in @($graph.hubMetrics | Where-Object { $_.hubScore -ge 10 } | Select-Object -First 10)) {
    Add-Finding -Severity 'Medium' -Category 'Impact Analysis' -Title 'High-impact hub measure' -Detail ("Measure `{0}` has dependency hub score {1}. Validate downstream impact before changing it." -f $hub.name, $hub.hubScore) -Source $hub.name
}

$riskScore = ($findings | Measure-Object -Property Score -Sum).Sum
if (-not $riskScore) { $riskScore = 0 }
$riskLevel = if ($riskScore -ge $rules.thresholds.highRiskScore) { 'High' } elseif ($riskScore -ge $rules.thresholds.mediumRiskScore) { 'Medium' } else { 'Low' }

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveInsightScan.v1'
    server = $catalog.server
    generated = (Get-Date).ToString('s')
    riskLevel = $riskLevel
    riskScore = $riskScore
    tableCount = $summary.tableCount
    measureCount = $catalog.metricCount
    relationshipCount = $summary.relationshipCount
    dependencyEdgeCount = $graph.edgeCount
    reviewMetricCount = $catalog.reviewMetricCount
    findings = @($findings | Sort-Object Score, Category, Title -Descending)
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Insight Scan')
$lines.Add('')
$lines.Add(('Server: `{0}`' -f $result.server))
$lines.Add(('- Risk level: **{0}**' -f $result.riskLevel))
$lines.Add(('- Risk score: **{0}**' -f $result.riskScore))
$lines.Add(('- Tables: {0}' -f $result.tableCount))
$lines.Add(('- Measures: {0}' -f $result.measureCount))
$lines.Add(('- Relationships: {0}' -f $result.relationshipCount))
$lines.Add(('- Dependency edges: {0}' -f $result.dependencyEdgeCount))
$lines.Add('')
$lines.Add('## Findings')
$lines.Add('')
foreach ($finding in $result.findings) {
    $lines.Add(('### [{0}] {1}' -f $finding.Severity, $finding.Title))
    $lines.Add(('- Category: {0}' -f $finding.Category))
    $lines.Add(('- Source: `{0}`' -f $finding.Source))
    $lines.Add(('- Detail: {0}' -f $finding.Detail))
    $lines.Add('')
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
