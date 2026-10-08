param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$dmvScript = Join-Path $PSScriptRoot 'Invoke-PowerBILiveDmv.ps1'

function Invoke-DmvJson {
    param([string]$Query)
    & $dmvScript -Server $Server -Query $Query -Json | ConvertFrom-Json
}

$catalogs = Invoke-DmvJson -Query 'SELECT * FROM $SYSTEM.DBSCHEMA_CATALOGS'
$tables = Invoke-DmvJson -Query 'SELECT * FROM $SYSTEM.TMSCHEMA_TABLES'
$columns = Invoke-DmvJson -Query 'SELECT * FROM $SYSTEM.TMSCHEMA_COLUMNS'
$measures = Invoke-DmvJson -Query 'SELECT * FROM $SYSTEM.TMSCHEMA_MEASURES'
$relationships = Invoke-DmvJson -Query 'SELECT * FROM $SYSTEM.TMSCHEMA_RELATIONSHIPS'

$summary = [pscustomobject]@{
    schema = 'codex.powerbi.liveModelSummary.v1'
    generated = (Get-Date).ToString('s')
    server = if ($Server) { $Server } else { $catalogs.server }
    catalogCount = $catalogs.rowCount
    tableCount = $tables.rowCount
    columnCount = $columns.rowCount
    measureCount = $measures.rowCount
    relationshipCount = $relationships.rowCount
    catalogs = @($catalogs.rows)
    tables = @($tables.rows | Select-Object Name, Description, IsHidden)
    measures = @($measures.rows | Select-Object Name, TableID, Expression, Description, IsHidden)
    relationships = @($relationships.rows)
}

if ($Json) {
    $jsonText = $summary | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Model Summary')
$lines.Add('')
$lines.Add(('Server: `{0}`' -f $summary.server))
$lines.Add(('Catalogs: {0}' -f $summary.catalogCount))
$lines.Add(('Tables: {0}' -f $summary.tableCount))
$lines.Add(('Columns: {0}' -f $summary.columnCount))
$lines.Add(('Measures: {0}' -f $summary.measureCount))
$lines.Add(('Relationships: {0}' -f $summary.relationshipCount))
$lines.Add('')
$lines.Add('## Tables')
$lines.Add('')
foreach ($table in $summary.tables) {
    $hidden = if ($table.IsHidden) { 'hidden' } else { 'visible' }
    $lines.Add(('- `{0}` ({1})' -f $table.Name, $hidden))
}
$lines.Add('')
$lines.Add('## Measures')
$lines.Add('')
foreach ($measure in $summary.measures) {
    $lines.Add(('### {0}' -f $measure.Name))
    $lines.Add('')
    $lines.Add('```DAX')
    $lines.Add($measure.Expression)
    $lines.Add('```')
    $lines.Add('')
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
