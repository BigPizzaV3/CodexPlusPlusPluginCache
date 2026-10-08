param(
    [Parameter(Mandatory=$true)][string]$TableName,
    [Parameter(Mandatory=$true)][string]$ColumnName,
    [Parameter(Mandatory=$true)][string]$Expression,
    [string]$DataType = 'string',
    [string]$Description = '',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$tmdl = New-Object System.Collections.Generic.List[string]
$tmdl.Add(('table {0}' -f $TableName))
$tmdl.Add(('    column {0} = ```' -f $ColumnName))
$tmdl.Add($Expression)
$tmdl.Add('    ```')
$tmdl.Add(('        dataType: {0}' -f $DataType))
$tmdl.Add('        summarizeBy: none')
if ($Description) { $tmdl.Add(('        description: "{0}"' -f ($Description.Replace('"', '\"')))) }

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Calculated Column Draft')
$md.Add('')
$md.Add(('Target table: `{0}`' -f $TableName))
$md.Add(('Column: `{0}`' -f $ColumnName))
$md.Add('')
$md.Add('Best practice: prefer Power Query or source-system columns when the value is row-level and static. Use calculated columns only when model-time DAX semantics are required.')
$md.Add('')
$md.Add('## TMDL Draft')
$md.Add('')
$md.Add('```tmdl')
$md.AddRange($tmdl)
$md.Add('```')
$md.Add('')
$md.Add('Rollback: remove the column from PBIP/TMDL or revert the source-control change.')

$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }

$result = [pscustomobject]@{
    schema = 'codex.powerbi.calculatedColumnDraft.v1'
    objectType = 'CalculatedColumn'
    tableName = $TableName
    columnName = $ColumnName
    expression = $Expression
    dataType = $DataType
    tmdl = ($tmdl -join [Environment]::NewLine)
    outputPath = $OutputPath
    safety = 'Draft only. Prefer Power Query/source columns unless a DAX calculated column is explicitly justified.'
}

if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result

