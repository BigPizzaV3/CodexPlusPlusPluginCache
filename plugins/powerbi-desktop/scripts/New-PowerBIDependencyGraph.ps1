param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json,
    [switch]$Mermaid
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalogScript = Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1'
$catalog = & $catalogScript -Path $Path -Json | ConvertFrom-Json
$metrics = @($catalog.metrics)

$metricByName = @{}
foreach ($metric in $metrics) {
    $metricByName[$metric.name.ToLowerInvariant()] = $metric
}

$edgeList = New-Object System.Collections.Generic.List[object]
$edgeKeys = @{}
foreach ($metric in $metrics) {
    foreach ($match in [regex]::Matches($metric.expression, '\[(?<name>[^\]]+)\]')) {
        $targetName = $match.Groups['name'].Value.Trim()
        if ($targetName -and $targetName -ne $metric.name -and $metricByName.ContainsKey($targetName.ToLowerInvariant())) {
            $edgeKey = ('{0}->{1}' -f $metric.name.ToLowerInvariant(), $targetName.ToLowerInvariant())
            if ($edgeKeys.ContainsKey($edgeKey)) {
                continue
            }
            $edgeKeys[$edgeKey] = $true
            $edgeList.Add([pscustomobject]@{
                from = $metric.name
                to = $targetName
                fromId = $metric.id
                toId = $metricByName[$targetName.ToLowerInvariant()].id
                source = $metric.source
            })
        }
    }
}

$graphEdges = @($edgeList.ToArray())
$nodes = @(foreach ($metric in $metrics) {
    $incoming = @($graphEdges | Where-Object { $_.to -eq $metric.name }).Count
    $outgoing = @($graphEdges | Where-Object { $_.from -eq $metric.name }).Count
    [pscustomobject]@{
        id = $metric.id
        name = $metric.name
        table = $metric.table
        source = $metric.source
        riskLevel = $metric.riskLevel
        incoming = $incoming
        outgoing = $outgoing
        hubScore = $incoming + $outgoing
    }
})
$hubMetrics = @($nodes | Sort-Object -Property hubScore -Descending | Select-Object -First 10)

$graph = [pscustomobject]@{
    schema = 'codex.powerbi.dependencyGraph.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    nodeCount = @($nodes).Count
    edgeCount = @($graphEdges).Count
    hubMetrics = @($hubMetrics)
    nodes = @($nodes)
    edges = @($graphEdges)
}

if ($Json) {
    $jsonText = $graph | ConvertTo-Json -Depth 8
    if ($OutputPath) {
        Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8
    }
    $jsonText
    return
}

if ($Mermaid) {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('flowchart LR')
    foreach ($node in $nodes) {
        $safeId = $node.id -replace '[^A-Za-z0-9_]', '_'
        $label = $node.name.Replace('"', "'")
        $lines.Add(('  {0}["{1}"]' -f $safeId, $label))
    }
    foreach ($edge in $graphEdges) {
        $from = $edge.fromId -replace '[^A-Za-z0-9_]', '_'
        $to = $edge.toId -replace '[^A-Za-z0-9_]', '_'
        $lines.Add(('  {0} --> {1}' -f $from, $to))
    }
    $content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    if ($OutputPath) {
        Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
    }
    $content
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI DAX Dependency Graph')
$md.Add('')
$md.Add(('Schema: `{0}`' -f $graph.schema))
$md.Add(('Metrics: {0}' -f $graph.nodeCount))
$md.Add(('Dependencies: {0}' -f $graph.edgeCount))
$md.Add('')
$md.Add('## Hub Metrics')
$md.Add('')
foreach ($node in $graph.hubMetrics) {
    $md.Add(('- `{0}`: incoming {1}, outgoing {2}, risk {3}' -f $node.name, $node.incoming, $node.outgoing, $node.riskLevel))
}
$md.Add('')
$md.Add('## Dependencies')
$md.Add('')
if ($graphEdges.Count -eq 0) {
    $md.Add('No metric-to-metric dependencies detected.')
}
else {
    foreach ($edge in $graphEdges) {
        $md.Add(('- `{0}` depends on `{1}`' -f $edge.from, $edge.to))
    }
}

$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
}
$content
