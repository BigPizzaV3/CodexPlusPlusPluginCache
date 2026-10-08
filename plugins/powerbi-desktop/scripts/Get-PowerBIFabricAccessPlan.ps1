param(
    [string]$TenantId,
    [string]$WorkspaceId,
    [string]$WorkspaceName,
    [string]$ItemId,
    [string]$AccessTokenPath,
    [string]$SnapshotDirectory,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$accessIssues = New-Object System.Collections.Generic.List[object]
$checks = New-Object System.Collections.Generic.List[object]

if (-not $AccessTokenPath -or -not (Test-Path -LiteralPath $AccessTokenPath)) {
    $accessIssues.Add([pscustomobject]@{ code = 'NeedsToken'; severity = 'High'; detail = 'Provide -AccessTokenPath with an explicit bearer token file. The plugin never signs in implicitly.' })
}
if (-not $WorkspaceId -and -not $WorkspaceName) {
    $accessIssues.Add([pscustomobject]@{ code = 'NeedsWorkspaceScope'; severity = 'High'; detail = 'Provide -WorkspaceId or -WorkspaceName for workspace-level Fabric live reads.' })
}
if ($SnapshotDirectory -and -not (Test-Path -LiteralPath $SnapshotDirectory)) {
    $accessIssues.Add([pscustomobject]@{ code = 'SnapshotNotFound'; severity = 'Medium'; detail = "Snapshot directory not found: $SnapshotDirectory" })
}

foreach ($name in @('workspaces','items','reports','semanticModels','refreshHistory','lineage','endorsements','sensitivityLabels','deploymentPipelines','capacities','gateways','activityEvents')) {
    $checks.Add([pscustomobject]@{ name = $name; mode = 'ReadOnly'; required = $name -in @('workspaces','items','semanticModels','reports'); mutation = $false })
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.fabricAccessPlan.v1'
    generated = (Get-Date).ToString('s')
    tenantId = $TenantId
    workspaceId = $WorkspaceId
    workspaceName = $WorkspaceName
    itemId = $ItemId
    accessTokenPath = if ($AccessTokenPath) { $AccessTokenPath } else { $null }
    snapshotDirectory = $SnapshotDirectory
    mode = 'ReadOnly'
    status = if ($accessIssues.Count -gt 0) { 'NeedsAccessPlan' } else { 'ReadyForReadOnlySnapshot' }
    accessIssueCount = $accessIssues.Count
    accessIssues = @($accessIssues.ToArray())
    plannedChecks = @($checks.ToArray())
    guardrails = @('GET requests only', 'No publish', 'No promote', 'No refresh trigger', 'No rebind', 'No delete', 'No endorsement writes')
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$lines = @('# Power BI Fabric Access Plan', '', "Status: **$($result.status)**", '', '## Guardrails') + @($result.guardrails | ForEach-Object { "- $_" })
if ($accessIssues.Count -gt 0) { $lines += @('', '## Access Issues') + @($accessIssues | ForEach-Object { "- [$($_.severity)] $($_.code): $($_.detail)" }) }
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
