param(
    [string]$Path = ".",
    [string]$ReviewDirectory,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path

function Read-JsonArtifact {
    param([string]$FilePath)
    if (-not $FilePath -or -not (Test-Path -LiteralPath $FilePath)) { return $null }
    try { return Get-Content -Raw -LiteralPath $FilePath | ConvertFrom-Json } catch { return $null }
}

function Add-Node {
    param($List, [string]$Id, [string]$Type, [string]$Label, [string]$Status, [string]$Source)
    $List.Add([pscustomobject]@{ id = $Id; type = $Type; label = $Label; status = $Status; source = $Source }) | Out-Null
}

function Add-Edge {
    param($List, [string]$From, [string]$To, [string]$Relation)
    $List.Add([pscustomobject]@{ from = $From; to = $To; relation = $Relation }) | Out-Null
}

$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $root -Json | ConvertFrom-Json
$deps = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $root -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $root -Json | ConvertFrom-Json
$visualImpact = & (Join-Path $scriptRoot 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $root -Json | ConvertFrom-Json

$nodes = New-Object System.Collections.Generic.List[object]
$edges = New-Object System.Collections.Generic.List[object]
Add-Node -List $nodes -Id 'model' -Type 'Model' -Label (Split-Path -Leaf $root) -Status 'Source' -Source $root

foreach ($metric in @($catalog.metrics)) {
    $metricId = 'metric:' + $metric.id
    $trustMetric = @($trust.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    $status = if ($trustMetric) { $trustMetric.trustBand } else { $metric.riskLevel }
    Add-Node -List $nodes -Id $metricId -Type 'Metric' -Label $metric.name -Status $status -Source $metric.source
    Add-Edge -List $edges -From 'model' -To $metricId -Relation 'contains'
}

foreach ($edge in @($deps.edges)) {
    Add-Edge -List $edges -From ('metric:' + $edge.fromId) -To ('metric:' + $edge.toId) -Relation 'dependsOn'
}

foreach ($test in @($semantic.tests)) {
    $testLabelCandidates = @($test.measure, $test.measureName, $test.metricName, $test.name, $test.id) | Where-Object { $_ }
    $testLabel = if ($testLabelCandidates.Count -gt 0) { [string]$testLabelCandidates[0] } else { 'Semantic test' }
    $testStatusCandidates = @($test.result, $test.status) | Where-Object { $_ }
    $testStatus = if ($testStatusCandidates.Count -gt 0) { [string]$testStatusCandidates[0] } else { 'Unknown' }
    $testId = 'semantic-test:' + ($testLabel -replace '[^A-Za-z0-9_-]', '-')
    Add-Node -List $nodes -Id $testId -Type 'SemanticTest' -Label $testLabel -Status $testStatus -Source 'semantic-tests'
    $measureCandidates = @($test.measure, $test.measureName, $test.metricName) | Where-Object { $_ }
    $measure = if ($measureCandidates.Count -gt 0) { [string]$measureCandidates[0] } else { $null }
    if ($measure) {
        $metric = @($catalog.metrics | Where-Object { $_.name -eq $measure } | Select-Object -First 1)
        if ($metric) { Add-Edge -List $edges -From ('metric:' + $metric.id) -To $testId -Relation 'validatedBy' }
    }
}

foreach ($impact in @($visualImpact.impacts | Where-Object { $_.detectedVisualReferences -gt 0 })) {
    $metric = @($catalog.metrics | Where-Object { $_.name -eq $impact.measure } | Select-Object -First 1)
    foreach ($visual in @($impact.affectedVisuals)) {
        $visualId = 'visual:' + (($visual.source + ':' + $visual.visual) -replace '[^A-Za-z0-9_-]', '-')
        Add-Node -List $nodes -Id $visualId -Type 'Visual' -Label $visual.visual -Status $visual.visualType -Source $visual.source
        if ($metric) { Add-Edge -List $edges -From ('metric:' + $metric.id) -To $visualId -Relation 'usedBy' }
    }
}

$reviewArtifacts = @()
if ($ReviewDirectory -and (Test-Path -LiteralPath $ReviewDirectory)) {
    $reviewArtifacts = @(Get-ChildItem -LiteralPath $ReviewDirectory -File -Filter '*.json' -ErrorAction SilentlyContinue | Sort-Object Name)
    foreach ($artifact in $reviewArtifacts) {
        $doc = Read-JsonArtifact -FilePath $artifact.FullName
        $schema = if ($doc -and $doc.schema) { [string]$doc.schema } else { 'json' }
        Add-Node -List $nodes -Id ('artifact:' + $artifact.BaseName) -Type 'ReviewArtifact' -Label $artifact.Name -Status $schema -Source $artifact.FullName
        Add-Edge -List $edges -From 'model' -To ('artifact:' + $artifact.BaseName) -Relation 'reviewedBy'
    }
}

$weakMetrics = @($trust.metrics | Where-Object { $_.trustScore -lt 70 })
$result = [pscustomobject]@{
    schema = 'codex.powerbi.evidenceGraph.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    nodeCount = $nodes.Count
    edgeCount = $edges.Count
    reviewArtifactCount = @($reviewArtifacts).Count
    evidenceStrength = if ($semantic.failedCount -eq 0 -and $semantic.pendingCount -eq 0 -and $weakMetrics.Count -eq 0) { 'High' } elseif ($semantic.testCount -gt 0 -or $trust.metricCount -gt 0) { 'Medium' } else { 'Low' }
    weakestMetrics = @($weakMetrics | Sort-Object trustScore, name | Select-Object -First 10)
    nodes = @($nodes.ToArray())
    edges = @($edges.ToArray())
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Power BI Evidence Graph',
    '',
    ('Evidence strength: **{0}**' -f $result.evidenceStrength),
    ('Nodes: {0}' -f $result.nodeCount),
    ('Edges: {0}' -f $result.edgeCount),
    '',
    '## Weakest Metrics'
) + @($result.weakestMetrics | ForEach-Object { '- `{0}`: trust {1}, band {2}' -f $_.name, $_.trustScore, $_.trustBand })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
