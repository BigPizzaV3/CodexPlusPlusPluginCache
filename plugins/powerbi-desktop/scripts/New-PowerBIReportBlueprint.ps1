param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalogScript = Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1'
$catalog = & $catalogScript -Path $Path -Json | ConvertFrom-Json

$metrics = @($catalog.metrics)
$financeMetrics = @($metrics | Where-Object { $_.tags -contains 'finance' })
$timeMetrics = @($metrics | Where-Object { $_.tags -contains 'time-intelligence' })
$reviewMetrics = @($metrics | Where-Object { $_.riskLevel -eq 'review' })

$pages = @(
    [pscustomobject]@{
        Name = 'Executive Overview'
        Purpose = 'Give leadership a fast read on the most important governed metrics.'
        Visuals = @(
            'KPI row for primary finance metrics',
            'Trend line for time-intelligence metrics',
            'Variance callout for metrics tagged as ratio or YoY',
            'Risk banner if review metrics remain unresolved'
        )
        Measures = @($financeMetrics | Select-Object -First 6 | ForEach-Object { $_.name })
    },
    [pscustomobject]@{
        Name = 'Metric Diagnostics'
        Purpose = 'Expose measure definitions, owners, and validation state for analysts.'
        Visuals = @(
            'Metric catalog table with owner, business definition, and risk level',
            'DAX review queue filtered to riskLevel = review',
            'Validation checklist slicer by source file'
        )
        Measures = @($reviewMetrics | ForEach-Object { $_.name })
    },
    [pscustomobject]@{
        Name = 'Model Governance'
        Purpose = 'Track project readiness, source-control posture, and refresh dependencies.'
        Visuals = @(
            'Finding count by severity',
            'Power Query dependency list',
            'PBIP/TMDL readiness status',
            'Next-action backlog'
        )
        Measures = @()
    }
)

if ($timeMetrics.Count -eq 0) {
    $pages[0].Visuals += 'Date slicer with explicit latest refresh date label'
}

$blueprint = [pscustomobject]@{
    schema = 'codex.powerbi.reportBlueprint.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    metricCount = $catalog.metricCount
    pageCount = $pages.Count
    designPrinciples = @(
        'Use dense, scannable executive pages with clear metric ownership.',
        'Keep diagnostic and governance content separate from business-consumption pages.',
        'Surface unresolved metric risks visibly until owners sign off.',
        'Avoid ambiguous KPI titles; use business definitions from the metric catalog.'
    )
    pages = $pages
}

if ($Json) {
    $jsonText = $blueprint | ConvertTo-Json -Depth 8
    if ($OutputPath) {
        Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8
    }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Report Blueprint')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $blueprint.schema))
$lines.Add(('Root: `{0}`' -f $blueprint.root))
$lines.Add(('Metrics considered: {0}' -f $blueprint.metricCount))
$lines.Add('')
$lines.Add('## Design Principles')
$lines.Add('')
foreach ($principle in $blueprint.designPrinciples) {
    $lines.Add(('- {0}' -f $principle))
}
$lines.Add('')
$lines.Add('## Pages')
$lines.Add('')
foreach ($page in $blueprint.pages) {
    $lines.Add(('### {0}' -f $page.Name))
    $lines.Add('')
    $lines.Add(('- Purpose: {0}' -f $page.Purpose))
    $lines.Add('- Visuals:')
    foreach ($visual in $page.Visuals) {
        $lines.Add(('  - {0}' -f $visual))
    }
    if ($page.Measures.Count -gt 0) {
        $lines.Add(('- Measures: {0}' -f ($page.Measures -join ', ')))
    }
    else {
        $lines.Add('- Measures: derived from scan and governance outputs')
    }
    $lines.Add('')
}

$markdown = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8
}
$markdown
