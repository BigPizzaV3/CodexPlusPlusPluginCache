param(
    [Parameter(Mandatory=$true)][string]$PbipPath,
    [Parameter(Mandatory=$true)][string]$ObjectName,
    [Parameter(Mandatory=$true)][string]$Tmdl,
    [ValidateSet('Measure','CalculatedColumn','CalculationGroup','Relationship','RLSRole','Generic')]
    [string]$ObjectType = 'Generic',
    [switch]$Apply,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PbipPath)
$safeName = ($ObjectName -replace '[^A-Za-z0-9_.-]', '_')
$draftRoot = Join-Path $root 'SemanticModel/drafts'
$targetPath = Join-Path $draftRoot "$safeName.tmdl"
$backupPath = $null
if ($Apply) {
    New-Item -ItemType Directory -Force -Path $draftRoot | Out-Null
    if (Test-Path -LiteralPath $targetPath) {
        $backupPath = "$targetPath.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
        Copy-Item -LiteralPath $targetPath -Destination $backupPath
    }
    Set-Content -LiteralPath $targetPath -Value ($Tmdl + [Environment]::NewLine) -Encoding UTF8
    $manifestPath = Join-Path $draftRoot 'draft-manifest.json'
    $entries = @()
    if (Test-Path -LiteralPath $manifestPath) {
        try { $entries = @((Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json).artifacts) } catch { $entries = @() }
    }
    $entries = @($entries | Where-Object { $_.path -ne $targetPath })
    $entries += [pscustomobject]@{ objectName = $ObjectName; objectType = $ObjectType; path = $targetPath; applied = (Get-Date).ToString('s') }
    [pscustomobject]@{ schema = 'codex.powerbi.pbipDraftManifest.v1'; artifacts = $entries } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.pbipTmdlApply.v1'; pbipPath = $root; objectName = $ObjectName; objectType = $ObjectType; applied = [bool]$Apply; targetPath = $targetPath; backupPath = $backupPath; rollback = 'Delete target draft file or restore backup, then validate PBIP in Power BI Desktop.' }
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result

