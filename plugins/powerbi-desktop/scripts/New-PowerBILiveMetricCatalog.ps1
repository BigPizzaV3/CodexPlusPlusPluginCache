param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$dmvScript = Join-Path $PSScriptRoot 'Invoke-PowerBILiveDmv.ps1'
$tables = & $dmvScript -Server $Server -Query 'SELECT * FROM $SYSTEM.TMSCHEMA_TABLES' -Json | ConvertFrom-Json
$measures = & $dmvScript -Server $Server -Query 'SELECT * FROM $SYSTEM.TMSCHEMA_MEASURES' -Json | ConvertFrom-Json

$tableById = @{}
foreach ($table in @($tables.rows)) {
    $tableById[[string]$table.ID] = $table.Name
}

function Get-MetricTags {
    param([string]$Name, [string]$Expression)
    $tags = New-Object System.Collections.Generic.List[string]
    $probe = "$Name $Expression"
    if ($probe -match '(?i)sla|breach|compliance') { $tags.Add('sla') }
    if ($probe -match '(?i)ticket|incident|case') { $tags.Add('operations') }
    if ($probe -match '(?i)customer|contact|csat|churn') { $tags.Add('customer') }
    if ($probe -match '(?i)cost|revenue|roi|profit') { $tags.Add('finance') }
    if ($probe -match '(?i)yoy|mtd|ytd|dateadd|today|month|week|year') { $tags.Add('time-intelligence') }
    if ($probe -match '(?i)divide\s*\(') { $tags.Add('ratio') }
    if ($tags.Count -eq 0) { $tags.Add('uncategorized') }
    $tags
}

function Get-MetricRisks {
    param([string]$Expression)
    $risks = New-Object System.Collections.Generic.List[string]
    if ($Expression -match '(?i)\bFILTER\s*\(\s*ALL\s*\(') { $risks.Add('performance: FILTER over ALL') }
    if ($Expression -match '(?i)\bTODAY\s*\(|\bNOW\s*\(') { $risks.Add('determinism: volatile date/time') }
    if ($Expression -match '(?i)\bCOUNTIF\s*\(') { $risks.Add('correctness: Excel-style COUNTIF in DAX') }
    if ($Expression -match '(?i)\bERROR\s*\(') { $risks.Add('usability: measure can intentionally raise ERROR') }
    if ($Expression -match '(?i)\bALL\s*\(\s*IncidentsAllFields') { $risks.Add('performance: ALL over fact table') }
    if (($Expression -split "`r?`n").Count -gt 20) { $risks.Add('maintainability: long expression') }
    $risks
}

$metrics = foreach ($measure in @($measures.rows)) {
    $tableName = $tableById[[string]$measure.TableID]
    $risks = @(Get-MetricRisks -Expression $measure.Expression)
    [pscustomobject]@{
        id = (("$tableName.$($measure.Name)").Trim('.')).ToLowerInvariant().Replace(' ', '-').Replace('%', 'pct')
        name = $measure.Name
        table = $tableName
        source = 'live-desktop'
        isHidden = $measure.IsHidden
        description = $measure.Description
        formatString = $measure.FormatString
        tags = @(Get-MetricTags -Name $measure.Name -Expression $measure.Expression)
        riskLevel = if ($risks.Count -gt 0) { 'review' } else { 'normal' }
        risks = $risks
        owner = '[TODO: metric owner]'
        businessDefinition = '[TODO: business definition]'
        validationQuestion = ('Does `{0}` reconcile to the accepted business source for the selected filter context?' -f $measure.Name)
        expression = $measure.Expression
    }
}

$catalog = [pscustomobject]@{
    schema = 'codex.powerbi.liveMetricCatalog.v1'
    server = if ($Server) { $Server } else { $measures.server }
    generated = (Get-Date).ToString('s')
    metricCount = @($metrics).Count
    reviewMetricCount = @($metrics | Where-Object { $_.riskLevel -eq 'review' }).Count
    metrics = @($metrics)
}

if ($Json) {
    $jsonText = $catalog | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Metric Catalog')
$lines.Add('')
$lines.Add(('Server: `{0}`' -f $catalog.server))
$lines.Add(('Metrics: {0}' -f $catalog.metricCount))
$lines.Add(('Metrics needing review: {0}' -f $catalog.reviewMetricCount))
$lines.Add('')
foreach ($metric in $catalog.metrics) {
    $lines.Add(('## {0}[{1}]' -f $metric.table, $metric.name))
    $lines.Add('')
    $lines.Add(('- ID: `{0}`' -f $metric.id))
    $lines.Add(('- Tags: {0}' -f ($metric.tags -join ', ')))
    $lines.Add(('- Risk level: {0}' -f $metric.riskLevel))
    if ($metric.risks.Count -gt 0) { $lines.Add(('- Risks: {0}' -f ($metric.risks -join '; '))) }
    $lines.Add(('- Owner: {0}' -f $metric.owner))
    $lines.Add(('- Business definition: {0}' -f $metric.businessDefinition))
    $lines.Add('')
    $lines.Add('```DAX')
    $lines.Add($metric.expression)
    $lines.Add('```')
    $lines.Add('')
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
