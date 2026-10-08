param(
    [string]$Path = ".",
    [string]$MetricName,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$graph = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -Json | ConvertFrom-Json
$metrics = if ($MetricName) { @($catalog.metrics | Where-Object { $_.name -eq $MetricName }) } else { @($catalog.metrics) }

function Add-Risk {
    param($List, [string]$Category, [string]$Severity, [string]$Reason, [string]$Recommendation)
    $List.Add([pscustomobject]@{ category = $Category; severity = $Severity; reason = $Reason; recommendation = $Recommendation }) | Out-Null
}

$classifications = foreach ($metric in $metrics) {
    $risks = New-Object System.Collections.Generic.List[object]
    $expr = [string]$metric.expression
    if ($expr -match '(?i)\bCALCULATE\s*\(') { Add-Risk $risks 'FilterContext' 'Medium' 'CALCULATE can change filter context.' 'Review filter modifiers and cross-filter behavior.' }
    if ($expr -match '(?i)\bALL(?:SELECTED)?\s*\(') { Add-Risk $risks 'FilterContext' 'High' 'ALL/ALLSELECTED can remove stakeholder filters.' 'Confirm denominator and slicer expectations.' }
    if ($expr -match '(?i)\bSAMEPERIODLASTYEAR|\bDATEADD|\bDATESYTD|\bTOTALYTD') { Add-Risk $risks 'TimeIntelligence' 'Medium' 'Time-intelligence function detected.' 'Validate calendar table, fiscal year and incomplete periods.' }
    if ($expr -match '(?i)\bSUMX|\bAVERAGEX|\bFILTER\s*\(') { Add-Risk $risks 'Performance' 'Medium' 'Iterator or row-by-row filter pattern detected.' 'Benchmark against realistic filter contexts.' }
    if ($expr -match '(?i)\bUSERELATIONSHIP|\bCROSSFILTER|\bTREATAS') { Add-Risk $risks 'RelationshipSensitivity' 'High' 'Relationship override or virtual relationship detected.' 'Validate relationship direction and ambiguity.' }
    if ($expr -match '(?i)/' -and $expr -notmatch '(?i)\bDIVIDE\s*\(') { Add-Risk $risks 'BlankAndZeroHandling' 'High' 'Raw division detected.' 'Use DIVIDE and define blank/zero behavior.' }
    if ($expr -match '(?i)\bFORMAT\s*\(') { Add-Risk $risks 'TypeStability' 'Medium' 'FORMAT converts numeric output to text.' 'Keep numeric measures numeric and use model formatting.' }
    if ($expr -match '(?i)\bTODAY\s*\(|\bNOW\s*\(') { Add-Risk $risks 'Determinism' 'Medium' 'Volatile date/time function detected.' 'Pin evaluation date for tests and releases.' }
    $incoming = @($graph.edges | Where-Object { $_.to -eq $metric.name }).Count
    $outgoing = @($graph.edges | Where-Object { $_.from -eq $metric.name }).Count
    if ($incoming -gt 0) { Add-Risk $risks 'BlastRadius' 'Medium' "$incoming downstream metric dependencies detected." 'Run dependency and visual impact checks before release.' }
    $high = @($risks.ToArray() | Where-Object { $_.severity -eq 'High' }).Count
    $medium = @($risks.ToArray() | Where-Object { $_.severity -eq 'Medium' }).Count
    [pscustomobject]@{
        metricName = $metric.name
        table = $metric.table
        source = $metric.source
        riskLevel = if ($high -gt 0) { 'High' } elseif ($medium -gt 1) { 'Medium' } elseif ($medium -eq 1) { 'Low' } else { 'Minimal' }
        highRiskCount = $high
        mediumRiskCount = $medium
        downstreamDependencyCount = $incoming
        upstreamDependencyCount = $outgoing
        risks = @($risks.ToArray())
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.daxChangeRiskClassifier.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    metricFilter = $MetricName
    metricCount = @($classifications).Count
    highRiskMetricCount = @($classifications | Where-Object { $_.riskLevel -eq 'High' }).Count
    classifications = @($classifications)
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI DAX Change Risk Classifier', '', ('Metrics: {0}' -f $result.metricCount), '') + @($result.classifications | ForEach-Object { '- `{0}`: {1} ({2} high, {3} medium)' -f $_.metricName, $_.riskLevel, $_.highRiskCount, $_.mediumRiskCount })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
