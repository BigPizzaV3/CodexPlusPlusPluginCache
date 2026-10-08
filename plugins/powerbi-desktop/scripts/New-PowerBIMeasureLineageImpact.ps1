param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$graph = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -Json | ConvertFrom-Json
$metrics = @($graph.nodes)
$edges = @($graph.edges)

$items = foreach ($metric in $metrics) {
    $upstream = @($edges | Where-Object { $_.from -eq $metric.name } | Select-Object -ExpandProperty to)
    $downstream = @($edges | Where-Object { $_.to -eq $metric.name } | Select-Object -ExpandProperty from)
    $impactScore = ($downstream.Count * 3) + $upstream.Count + ($(if ($metric.riskLevel -ne 'normal') { 2 } else { 0 }))
    [pscustomobject]@{
        id = $metric.id
        name = $metric.name
        table = $metric.table
        riskLevel = $metric.riskLevel
        upstreamMeasures = @($upstream)
        downstreamMeasures = @($downstream)
        upstreamCount = $upstream.Count
        downstreamCount = $downstream.Count
        impactScore = $impactScore
        changeGuidance = $(if ($downstream.Count -gt 0) { 'Validate dependent measures before publishing.' } else { 'Validate direct business result and formatting.' })
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.measureLineageImpact.v1'
    root = $graph.root
    generated = (Get-Date).ToString('s')
    measureCount = @($items).Count
    measures = @($items | Sort-Object -Property impactScore -Descending)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Measure Lineage Impact')
$md.Add('')
$md.Add(('Measures: {0}' -f $result.measureCount))
$md.Add('')
foreach ($item in $result.measures) {
    $md.Add(('## {0}' -f $item.name))
    $md.Add(('- Impact score: {0}' -f $item.impactScore))
    $md.Add(('- Upstream: {0}' -f ($(if ($item.upstreamCount) { $item.upstreamMeasures -join ', ' } else { 'none' }))))
    $md.Add(('- Downstream: {0}' -f ($(if ($item.downstreamCount) { $item.downstreamMeasures -join ', ' } else { 'none' }))))
    $md.Add(('- Guidance: {0}' -f $item.changeGuidance))
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

