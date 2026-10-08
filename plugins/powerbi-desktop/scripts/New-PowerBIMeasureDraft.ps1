param(
    [Parameter(Mandatory=$true)][string]$TableName,
    [Parameter(Mandatory=$true)][string]$MeasureName,
    [Parameter(Mandatory=$true)][string]$Expression,
    [string]$Description = '',
    [string]$FormatString = '',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$tmdl = New-Object System.Collections.Generic.List[string]
$tmdl.Add(('table {0}' -f $TableName))
$tmdl.Add(('    measure {0} = ```' -f $MeasureName))
$tmdl.Add($Expression)
$tmdl.Add('    ```')
if ($FormatString) { $tmdl.Add(('        formatString: {0}' -f $FormatString)) }
if ($Description) { $tmdl.Add(('        description: "{0}"' -f ($Description.Replace('"', '\"')))) }

$validationQueries = @(
    ('EVALUATE ROW("{0}", [{0}])' -f $MeasureName),
    ('EVALUATE ROW("IsBlank", ISBLANK([{0}]), "Value", [{0}])' -f $MeasureName)
)

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Measure Draft')
$md.Add('')
$md.Add(('Target table: `{0}`' -f $TableName))
$md.Add(('Measure: `{0}`' -f $MeasureName))
$md.Add('')
$md.Add('## TMDL Draft')
$md.Add('')
$md.Add('```tmdl')
$md.AddRange($tmdl)
$md.Add('```')
$md.Add('')
$md.Add('## Validation Queries')
foreach ($query in $validationQueries) {
    $md.Add('')
    $md.Add('```DAX')
    $md.Add($query)
    $md.Add('```')
}
$md.Add('')
$md.Add('Rollback: remove the measure from PBIP/TMDL or revert the source-control change.')

$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }

$result = [pscustomobject]@{
    schema = 'codex.powerbi.measureDraft.v1'
    objectType = 'Measure'
    tableName = $TableName
    measureName = $MeasureName
    expression = $Expression
    tmdl = ($tmdl -join [Environment]::NewLine)
    validationQueries = $validationQueries
    outputPath = $OutputPath
    safety = 'Draft only. Apply through PBIP/TMDL or Tabular Editor after backup and validation.'
}

if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result

