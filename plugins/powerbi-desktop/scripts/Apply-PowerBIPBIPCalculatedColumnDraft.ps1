param([string]$PbipPath, [string]$TableName, [string]$ColumnName, [string]$Expression, [string]$DataType = 'string', [switch]$Apply, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$draft = & (Join-Path $scriptRoot 'New-PowerBICalculatedColumnDraft.ps1') -TableName $TableName -ColumnName $ColumnName -Expression $Expression -DataType $DataType -Json | ConvertFrom-Json
$result = & (Join-Path $scriptRoot 'Apply-PowerBIPBIPTmdlDraft.ps1') -PbipPath $PbipPath -ObjectName "$TableName.$ColumnName" -ObjectType CalculatedColumn -Tmdl $draft.tmdl -Apply:$Apply -Json | ConvertFrom-Json
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result

