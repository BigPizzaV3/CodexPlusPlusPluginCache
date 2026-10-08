param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json,
    [switch]$Mermaid
)

$ErrorActionPreference = 'Stop'

$catalogScript = Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1'
$catalog = & $catalogScript -Server $Server -Json | ConvertFrom-Json
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
            if ($edgeKeys.ContainsKey($edgeKey)) { continue }
            $edgeKeys[$edgeKey] = $true
            $target = $metricByName[$targetName.ToLowerInvariant()]
            $edgeList.Add([pscustomobject]@{
                from = $metric.name
                to = $targetName
                fromId = $metric.id
                toId = $target.id
                source = $metric.source
            })
        }
    }
}

$edges = @($edgeList.ToArray())
$nodes = @(foreach ($metric in $metrics) {
    $incoming = @($edges | Where-Object { $_.to -eq $metric.name }).Count
    $outgoing = @($edges | Where-Object { $_.from -eq $metric.name }).Count
    [pscustomobject]@{
        id = $metric.id
        name = $metric.name
        table = $metric.table
        riskLevel = $metric.riskLevel
        incoming = $incoming
        outgoing = $outgoing
        hubScore = $incoming + $outgoing
    }
})

$graph = [pscustomobject]@{
    schema = 'codex.powerbi.liveDependencyGraph.v1'
    server = $catalog.server
    generated = (Get-Date).ToString('s')
    nodeCount = $nodes.Count
    edgeCount = $edges.Count
    hubMetrics = @($nodes | Sort-Object -Property hubScore -Descending | Select-Object -First 20)
    nodes = @($nodes)
    edges = @($edges)
}

if ($Json) {
    $jsonText = $graph | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
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
    foreach ($edge in $edges) {
        $from = $edge.fromId -replace '[^A-Za-z0-9_]', '_'
        $to = $edge.toId -replace '[^A-Za-z0-9_]', '_'
        $lines.Add(('  {0} --> {1}' -f $from, $to))
    }
    $content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
    $content
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Live Dependency Graph')
$md.Add('')
$md.Add(('Server: `{0}`' -f $graph.server))
$md.Add(('Metrics: {0}' -f $graph.nodeCount))
$md.Add(('Dependencies: {0}' -f $graph.edgeCount))
$md.Add('')
$md.Add('## Top Hub Metrics')
$md.Add('')
foreach ($node in $graph.hubMetrics) {
    $md.Add(('- `{0}`: incoming {1}, outgoing {2}, risk {3}' -f $node.name, $node.incoming, $node.outgoing, $node.riskLevel))
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
