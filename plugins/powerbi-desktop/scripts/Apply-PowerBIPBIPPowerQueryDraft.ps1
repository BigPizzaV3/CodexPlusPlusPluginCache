param([string]$PbipPath, [string]$QueryName = 'NewQuery', [ValidateSet('DateTable','SqlTable','SharePointFile','Blank')] [string]$SourceKind = 'Blank', [switch]$Apply, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PbipPath)
$draft = & (Join-Path $scriptRoot 'New-PowerBIPowerQueryDraft.ps1') -QueryName $QueryName -SourceKind $SourceKind -Json | ConvertFrom-Json
$safeName = ($QueryName -replace '[^A-Za-z0-9_.-]', '_')
$targetRoot = Join-Path $root 'SemanticModel/queries'
$targetPath = Join-Path $targetRoot "$safeName.pq"
$backupPath = $null
if ($Apply) {
    New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
    if (Test-Path -LiteralPath $targetPath) {
        $backupPath = "$targetPath.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
        Copy-Item -LiteralPath $targetPath -Destination $backupPath
    }
    Set-Content -LiteralPath $targetPath -Value ($draft.mCode + [Environment]::NewLine) -Encoding UTF8
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.pbipPowerQueryApply.v1'; pbipPath = $root; objectType = 'PowerQuery'; queryName = $QueryName; applied = [bool]$Apply; targetPath = $targetPath; backupPath = $backupPath; rollback = 'Delete query draft or restore backup, then validate credentials/folding in Power BI Desktop.' }
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result

