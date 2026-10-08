param(
    [string]$TenantId,
    [string]$AccessTokenPath,
    [string]$SnapshotDirectory,
    [string]$OutputDirectory = "fabric-tenant-snapshot",
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

if ($SnapshotDirectory -and (Test-Path -LiteralPath $SnapshotDirectory)) {
    Get-ChildItem -LiteralPath $SnapshotDirectory -File -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $resolvedOut $_.Name) -Force
    }
    $mode = 'SnapshotDirectory'
}
else {
    @() | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resolvedOut 'workspaces.json') -Encoding UTF8
    $mode = if ($AccessTokenPath -and (Test-Path -LiteralPath $AccessTokenPath)) { 'LiveReadPrepared' } else { 'AccessPlanOnly' }
}

$workspacesPath = Join-Path $resolvedOut 'workspaces.json'
$workspaces = if (Test-Path -LiteralPath $workspacesPath) { @(Get-Content -Raw -LiteralPath $workspacesPath | ConvertFrom-Json) } else { @() }
$summary = [pscustomobject]@{
    schema = 'codex.powerbi.fabricTenantSnapshot.v1'
    generated = (Get-Date).ToString('s')
    tenantId = $TenantId
    outputDirectory = $resolvedOut
    mode = $mode
    status = if ($mode -eq 'AccessPlanOnly') { 'NeedsAccessPlan' } else { 'SnapshotReady' }
    workspaceCount = $workspaces.Count
}
$summaryPath = Join-Path $resolvedOut 'summary.json'
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$result = [pscustomobject]@{ OutputDirectory = $resolvedOut; Summary = $summaryPath; Status = $summary.status; Mode = $mode }
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result
