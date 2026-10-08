param(
    [string]$PluginRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path,
    [string]$BaselinesPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$resolvedPluginRoot = (Resolve-Path -LiteralPath $PluginRoot).Path
if (-not $BaselinesPath) {
    $BaselinesPath = Join-Path $resolvedPluginRoot 'rules/powerbi-golden-baselines.json'
}
$baselines = Get-Content -Raw -LiteralPath $BaselinesPath | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]

function Add-GoldenResult {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    $results.Add([pscustomobject]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    })
}

foreach ($baseline in @($baselines.baselines)) {
    $baselinePath = Join-Path $resolvedPluginRoot $baseline.path
    $catalog = & (Join-Path $PSScriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $baselinePath -Json | ConvertFrom-Json
    $graph = & (Join-Path $PSScriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $baselinePath -Json | ConvertFrom-Json
    $scan = & (Join-Path $PSScriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $baselinePath -Json | ConvertFrom-Json

    Add-GoldenResult -Name "$($baseline.name): metric count" -Passed ($catalog.metricCount -eq $baseline.metricCount) -Detail "Expected=$($baseline.metricCount), Actual=$($catalog.metricCount)"
    Add-GoldenResult -Name "$($baseline.name): dependency edges" -Passed ($graph.edgeCount -eq $baseline.dependencyEdgeCount) -Detail "Expected=$($baseline.dependencyEdgeCount), Actual=$($graph.edgeCount)"
    Add-GoldenResult -Name "$($baseline.name): insight findings" -Passed (@($scan.Findings).Count -eq $baseline.insightFindingCount) -Detail "Expected=$($baseline.insightFindingCount), Actual=$(@($scan.Findings).Count)"
    Add-GoldenResult -Name "$($baseline.name): insight risk floor" -Passed ($scan.RiskScore -ge $baseline.minimumInsightRiskScore) -Detail "Minimum=$($baseline.minimumInsightRiskScore), Actual=$($scan.RiskScore)"

    foreach ($measureName in @($baseline.requiredMeasures)) {
        $exists = @($catalog.metrics | Where-Object { $_.name -eq $measureName }).Count -gt 0
        Add-GoldenResult -Name "$($baseline.name): measure $measureName" -Passed $exists -Detail "Required measure present=$exists"
    }
}

$summary = [pscustomobject]@{
    schema = 'codex.powerbi.goldenBaselineResults.v1'
    generated = (Get-Date).ToString('s')
    baselineCount = @($baselines.baselines).Count
    checkCount = $results.Count
    passedCount = @($results | Where-Object { $_.passed }).Count
    failedCount = @($results | Where-Object { -not $_.passed }).Count
    results = @($results.ToArray())
}

if ($Json) {
    $summary | ConvertTo-Json -Depth 8
    if ($summary.failedCount -gt 0) { exit 1 }
    return
}

$summary.results | Format-Table name, passed, detail -AutoSize
if ($summary.failedCount -gt 0) { exit 1 }
