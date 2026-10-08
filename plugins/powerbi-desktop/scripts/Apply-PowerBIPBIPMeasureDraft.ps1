param([string]$PbipPath, [string]$TableName, [string]$MeasureName, [string]$Expression, [switch]$Apply, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$draft = & (Join-Path $scriptRoot 'New-PowerBIMeasureDraft.ps1') -TableName $TableName -MeasureName $MeasureName -Expression $Expression -Json | ConvertFrom-Json
$result = & (Join-Path $scriptRoot 'Apply-PowerBIPBIPTmdlDraft.ps1') -PbipPath $PbipPath -ObjectName "$TableName.$MeasureName" -ObjectType Measure -Tmdl $draft.tmdl -Apply:$Apply -Json | ConvertFrom-Json
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result

