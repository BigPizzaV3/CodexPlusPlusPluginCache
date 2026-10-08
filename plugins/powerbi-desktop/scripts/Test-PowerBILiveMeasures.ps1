param(
    [string]$Server,
    [string]$OutputPath,
    [int]$Top = 25,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$catalog = & (Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1') -Server $Server -Json | ConvertFrom-Json
$graph = & (Join-Path $PSScriptRoot 'New-PowerBILiveDependencyGraph.ps1') -Server $Server -Json | ConvertFrom-Json
$queryScript = Join-Path $PSScriptRoot 'Invoke-PowerBILiveDaxQuery.ps1'

$hubNames = @($graph.hubMetrics | Select-Object -First $Top | ForEach-Object { $_.name })
$reviewNames = @($catalog.metrics | Where-Object { $_.riskLevel -eq 'review' } | Select-Object -First ([Math]::Max(5, [int]($Top / 2))) | ForEach-Object { $_.name })
$selectedNames = @($hubNames + $reviewNames | Select-Object -Unique | Select-Object -First $Top)
$metricByName = @{}
foreach ($metric in @($catalog.metrics)) { $metricByName[$metric.name] = $metric }

$results = foreach ($name in $selectedNames) {
    $metric = $metricByName[$name]
    if (-not $metric) { continue }
    $daxName = $metric.name.Replace(']', ']]')
    $label = $metric.name -replace '"', '""'
    $query = "EVALUATE ROW(""$label"", [$daxName])"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $result = & $queryScript -Server $Server -Query $query -Json | ConvertFrom-Json
        $sw.Stop()
        $value = $null
        if ($result.rows.Count -gt 0) {
            $props = $result.rows[0].PSObject.Properties
            if ($props.Count -gt 0) { $value = $props[0].Value }
        }
        [pscustomobject]@{
            name = $metric.name
            table = $metric.table
            status = 'Passed'
            elapsedMs = $sw.ElapsedMilliseconds
            value = $value
            error = $null
        }
    }
    catch {
        $sw.Stop()
        [pscustomobject]@{
            name = $metric.name
            table = $metric.table
            status = 'Failed'
            elapsedMs = $sw.ElapsedMilliseconds
            value = $null
            error = $_.Exception.Message
        }
    }
}

$summary = [pscustomobject]@{
    schema = 'codex.powerbi.liveMeasureValidation.v1'
    generated = (Get-Date).ToString('s')
    testedCount = @($results).Count
    passedCount = @($results | Where-Object { $_.status -eq 'Passed' }).Count
    failedCount = @($results | Where-Object { $_.status -eq 'Failed' }).Count
    results = @($results)
}

if ($Json) {
    $jsonText = $summary | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Measure Validation')
$lines.Add('')
$lines.Add(('Tested: {0}' -f $summary.testedCount))
$lines.Add(('Passed: {0}' -f $summary.passedCount))
$lines.Add(('Failed: {0}' -f $summary.failedCount))
$lines.Add('')
foreach ($item in $summary.results) {
    $lines.Add(('## [{0}] {1}' -f $item.status, $item.name))
    $lines.Add(('- Table: {0}' -f $item.table))
    $lines.Add(('- Elapsed ms: {0}' -f $item.elapsedMs))
    if ($item.status -eq 'Passed') { $lines.Add(('- Value: `{0}`' -f $item.value)) }
    if ($item.status -eq 'Failed') { $lines.Add(('- Error: {0}' -f $item.error)) }
    $lines.Add('')
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
