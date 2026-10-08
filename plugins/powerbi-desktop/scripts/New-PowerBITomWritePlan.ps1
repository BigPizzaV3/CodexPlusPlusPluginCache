param(
    [ValidateSet('AddMeasure','UpdateMeasure','AddRelationship','AddRole','AddCalculationGroup','RunTmsl')]
    [string]$Operation = 'AddMeasure',
    [string]$TableName,
    [string]$ObjectName,
    [string]$Expression,
    [string]$ConnectionString,
    [string]$OutputPath,
    [switch]$AllowWrite,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$safetyGates = @(
    [pscustomobject]@{ gate = 'Dry run default'; passed = (-not $AllowWrite); detail = 'No write is performed unless AllowWrite is explicitly set.' },
    [pscustomobject]@{ gate = 'Connection explicit'; passed = [bool]$ConnectionString; detail = 'A TOM/TMSL write path must target an explicit local or service endpoint.' },
    [pscustomobject]@{ gate = 'Backup required'; passed = $false; detail = 'Export PBIP/TMDL or model.bim before any write.' },
    [pscustomobject]@{ gate = 'Diff required'; passed = $false; detail = 'Review before/after TMDL/TMSL diff before apply.' },
    [pscustomobject]@{ gate = 'Rollback required'; passed = $false; detail = 'Define rollback script or source-control revert before apply.' }
)

$draft = switch ($Operation) {
    'AddMeasure' { "CREATE OR REPLACE MEASURE '$TableName'[$ObjectName] = $Expression" }
    'UpdateMeasure' { "ALTER MEASURE '$TableName'[$ObjectName] = $Expression" }
    'AddRelationship' { "CREATE RELATIONSHIP $ObjectName" }
    'AddRole' { "CREATE ROLE $ObjectName" }
    'AddCalculationGroup' { "CREATE CALCULATION GROUP $ObjectName" }
    default { $Expression }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.tomWritePlan.v1'
    generated = (Get-Date).ToString('s')
    operation = $Operation
    tableName = $TableName
    objectName = $ObjectName
    dryRun = (-not $AllowWrite)
    connectionStringProvided = [bool]$ConnectionString
    safetyGates = $safetyGates
    draftCommand = $draft
    writeStatus = if ($AllowWrite) { 'BlockedUntilBackupDiffRollbackConfirmed' } else { 'DryRunOnly' }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @('# TOM/TMSL Write Plan', '', "Operation: $Operation", "Dry run: $($result.dryRun)", '', '## Safety Gates') +
    @($safetyGates | ForEach-Object { "- [$($_.gate)] Passed=$($_.passed): $($_.detail)" }) +
    @('', '## Draft Command', '', '```text', $draft, '```')
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
