param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json

function Get-DecisionContext {
    param([object]$Metric)
    $name = $Metric.name
    if ($Metric.tags -contains 'finance' -or $name -match 'Sales|Cost|Revenue|Margin') { return 'Financial performance, budget steering, and commercial prioritization.' }
    if ($Metric.tags -contains 'customer' -or $name -match 'Customer|Churn|CSAT|SLA') { return 'Customer experience, service quality, and retention decisions.' }
    if ($Metric.tags -contains 'time-intelligence' -or $name -match 'YoY|Prior|Trend') { return 'Trend interpretation and period-over-period management reporting.' }
    return 'Operational monitoring and report navigation.'
}

$metrics = foreach ($metric in @($catalog.metrics)) {
    [pscustomobject]@{
        id = $metric.id
        name = $metric.name
        table = $metric.table
        owner = $metric.owner
        businessDefinition = $metric.businessDefinition
        decisionContext = Get-DecisionContext -Metric $metric
        allowedUse = 'Use after metric owner confirms definition and validation question.'
        prohibitedUse = $(if (@($metric.risks).Count -gt 0) { 'Do not use as sole executive decision input until risks are resolved.' } else { 'Do not use outside documented grain and filter context.' })
        requiredSignoff = $(if (@($metric.risks).Count -gt 0 -or $metric.owner -match 'TODO') { 'Business owner and BI owner' } else { 'BI owner' })
        interpretationWarning = $(if (@($metric.risks).Count -gt 0) { @($metric.risks) -join '; ' } else { 'No technical risk detected by local scan.' })
    }
}

$result = [pscustomobject]@{ schema = 'codex.powerbi.businessSemanticLayer.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); metricCount = @($metrics).Count; metrics = @($metrics) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Business Semantic Layer'); $md.Add(''); $md.Add(('Metrics: {0}' -f $result.metricCount)); $md.Add('')
foreach ($metric in $result.metrics) {
    $md.Add(('## {0}' -f $metric.name))
    $md.Add(('- Decision context: {0}' -f $metric.decisionContext))
    $md.Add(('- Allowed use: {0}' -f $metric.allowedUse))
    $md.Add(('- Prohibited use: {0}' -f $metric.prohibitedUse))
    $md.Add(('- Required sign-off: {0}' -f $metric.requiredSignoff))
    $md.Add(('- Warning: {0}' -f $metric.interpretationWarning))
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

