param(
    [string]$TenantId,
    [string]$WorkspaceId,
    [string]$WorkspaceName,
    [string]$ItemId,
    [string]$AccessTokenPath,
    [string]$SnapshotDirectory,
    [string]$OutputDirectory = "fabric-workspace-snapshot",
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

function Read-SnapshotJson {
    param([string]$Root, [string]$Name, $Fallback)
    $path = Join-Path $Root $Name
    if (Test-Path -LiteralPath $path) { return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json }
    return $Fallback
}

function Get-FabricValues {
    param($Response)
    if (-not $Response) { return @() }
    if ($Response.PSObject.Properties.Name -contains 'value') { return @($Response.value) }
    return @($Response)
}

function Invoke-FabricGet {
    param([string]$Uri, [string]$Name)
    $response = & (Join-Path $scriptRoot 'Invoke-PowerBIFabricReadOnlyRequest.ps1') -AccessTokenPath $AccessTokenPath -Uri $Uri -Json | ConvertFrom-Json
    [pscustomobject]@{
        name = $Name
        uri = $Uri
        status = $response.status
        error = $response.error
        values = @(Get-FabricValues -Response $response.data)
        data = $response.data
    }
}

$accessPlanPath = Join-Path $resolvedOut 'access-plan.json'
$accessPlan = & (Join-Path $scriptRoot 'Get-PowerBIFabricAccessPlan.ps1') -TenantId $TenantId -WorkspaceId $WorkspaceId -WorkspaceName $WorkspaceName -ItemId $ItemId -AccessTokenPath $AccessTokenPath -SnapshotDirectory $SnapshotDirectory -OutputPath $accessPlanPath -Json | ConvertFrom-Json

if ($SnapshotDirectory -and (Test-Path -LiteralPath $SnapshotDirectory)) {
    foreach ($name in @('workspace.json','items.json','reports.json','semantic-models.json','refresh-history.json','lineage.json','deployment-pipelines.json','capacities.json','gateways.json','activity.json','endorsements.json','sensitivity-labels.json')) {
        $source = Join-Path $SnapshotDirectory $name
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $resolvedOut $name) -Force }
    }
    $mode = 'SnapshotDirectory'
}
elseif ($accessPlan.status -eq 'ReadyForReadOnlySnapshot') {
    $baseUri = 'https://api.powerbi.com/v1.0/myorg'
    $endpointStatuses = New-Object System.Collections.Generic.List[object]

    if (-not $WorkspaceId -and $WorkspaceName) {
        $groupsResponse = Invoke-FabricGet -Uri "$baseUri/groups" -Name 'workspaces'
        $endpointStatuses.Add(($groupsResponse | Select-Object name, uri, status, error)) | Out-Null
        $matched = @($groupsResponse.values | Where-Object { $_.name -eq $WorkspaceName }) | Select-Object -First 1
        if ($matched) { $WorkspaceId = [string]$matched.id }
    }

    if ($WorkspaceId) {
        $workspaceResponse = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId" -Name 'workspace'
        $reportsResponse = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/reports" -Name 'reports'
        $datasetsResponse = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/datasets" -Name 'datasets'
        $dashboardsResponse = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/dashboards" -Name 'dashboards'

        foreach ($status in @($workspaceResponse, $reportsResponse, $datasetsResponse, $dashboardsResponse)) {
            $endpointStatuses.Add(($status | Select-Object name, uri, status, error)) | Out-Null
        }

        $workspace = if ($workspaceResponse.values.Count -gt 0) { $workspaceResponse.values[0] } else { [pscustomobject]@{ id = $WorkspaceId; name = $WorkspaceName; tenantId = $TenantId; source = 'LiveReadFailed' } }
        $reports = @($reportsResponse.values)
        $datasets = @($datasetsResponse.values)
        $dashboards = @($dashboardsResponse.values)
        $refreshRows = New-Object System.Collections.Generic.List[object]

        foreach ($dataset in $datasets) {
            $refreshResponse = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/datasets/$($dataset.id)/refreshes?`$top=10" -Name "refreshes:$($dataset.name)"
            $endpointStatuses.Add(($refreshResponse | Select-Object name, uri, status, error)) | Out-Null
            foreach ($refresh in @($refreshResponse.values)) {
                $refreshRows.Add([pscustomobject]@{
                    datasetId = $dataset.id
                    datasetName = $dataset.name
                    refreshId = $refresh.requestId
                    status = $refresh.status
                    startTime = $refresh.startTime
                    endTime = $refresh.endTime
                    refreshType = $refresh.refreshType
                    serviceExceptionJson = $refresh.serviceExceptionJson
                }) | Out-Null
            }
        }

        $items = @()
        $items += @($reports | ForEach-Object { [pscustomobject]@{ id = $_.id; name = $_.name; type = 'Report'; datasetId = $_.datasetId; webUrl = $_.webUrl; configuredBy = $_.configuredBy } })
        $items += @($datasets | ForEach-Object { [pscustomobject]@{ id = $_.id; name = $_.name; type = 'SemanticModel'; configuredBy = $_.configuredBy; isRefreshable = $_.isRefreshable; isOnPremGatewayRequired = $_.isOnPremGatewayRequired } })
        $items += @($dashboards | ForEach-Object { [pscustomobject]@{ id = $_.id; name = $_.displayName; type = 'Dashboard'; webUrl = $_.webUrl; configuredBy = $_.configuredBy } })

        $workspace | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $resolvedOut 'workspace.json') -Encoding UTF8
        $items | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $resolvedOut 'items.json') -Encoding UTF8
        $reports | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $resolvedOut 'reports.json') -Encoding UTF8
        $datasets | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $resolvedOut 'semantic-models.json') -Encoding UTF8
        @($refreshRows.ToArray()) | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $resolvedOut 'refresh-history.json') -Encoding UTF8
        @($endpointStatuses.ToArray()) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedOut 'endpoint-statuses.json') -Encoding UTF8
        $mode = 'LiveReadSnapshot'
    }
    else {
        $workspace = [pscustomobject]@{ id = $WorkspaceId; name = $WorkspaceName; tenantId = $TenantId; source = 'LiveReadScopeUnresolved' }
        $workspace | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $resolvedOut 'workspace.json') -Encoding UTF8
        @() | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resolvedOut 'items.json') -Encoding UTF8
        @($endpointStatuses.ToArray()) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedOut 'endpoint-statuses.json') -Encoding UTF8
        $mode = 'AccessPlanOnly'
    }
}
else {
    $workspace = [pscustomobject]@{ id = $WorkspaceId; name = $WorkspaceName; tenantId = $TenantId; source = 'AccessPlanOnly' }
    $workspace | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $resolvedOut 'workspace.json') -Encoding UTF8
    @() | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resolvedOut 'items.json') -Encoding UTF8
    $mode = 'AccessPlanOnly'
}

$items = @(Read-SnapshotJson -Root $resolvedOut -Name 'items.json' -Fallback @())
$refresh = @(Read-SnapshotJson -Root $resolvedOut -Name 'refresh-history.json' -Fallback @())
$lineage = @(Read-SnapshotJson -Root $resolvedOut -Name 'lineage.json' -Fallback @())
$endpointStatuses = @(Read-SnapshotJson -Root $resolvedOut -Name 'endpoint-statuses.json' -Fallback @())
$accessIssues = @($accessPlan.accessIssues)

$summary = [pscustomobject]@{
    schema = 'codex.powerbi.fabricWorkspaceSnapshot.v1'
    generated = (Get-Date).ToString('s')
    mode = $mode
    tenantId = $TenantId
    workspaceId = $WorkspaceId
    workspaceName = $WorkspaceName
    outputDirectory = $resolvedOut
    status = if ($accessIssues.Count -gt 0 -and $mode -eq 'AccessPlanOnly') { 'NeedsAccessPlan' } else { 'SnapshotReady' }
    itemCount = $items.Count
    refreshRecordCount = $refresh.Count
    lineageEdgeCount = $lineage.Count
    accessIssueCount = $accessIssues.Count
    accessIssues = $accessIssues
    endpointStatuses = @($endpointStatuses)
}
$summaryPath = Join-Path $resolvedOut 'summary.json'
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

$result = [pscustomobject]@{ OutputDirectory = $resolvedOut; Summary = $summaryPath; Status = $summary.status; Mode = $mode }
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result
