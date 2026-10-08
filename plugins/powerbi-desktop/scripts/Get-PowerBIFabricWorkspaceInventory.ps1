param(
    [string]$WorkspaceId,
    [string]$WorkspaceName = '[TODO: Fabric workspace]',
    [string]$TenantId,
    [string]$AccessTokenPath,
    [string]$OutputPath,
    [switch]$UseRest,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$mode = 'OfflinePlan'
$items = @()
$findings = New-Object System.Collections.Generic.List[object]
$nextActions = New-Object System.Collections.Generic.List[object]
$endpointStatuses = New-Object System.Collections.Generic.List[object]

function Get-FabricValues {
    param($Response)
    if (-not $Response) { return @() }
    if ($Response.PSObject.Properties.Name -contains 'value') { return @($Response.value) }
    return @($Response)
}

function Invoke-FabricGet {
    param([string]$Uri, [string]$Name)
    $response = & (Join-Path $PSScriptRoot 'Invoke-PowerBIFabricReadOnlyRequest.ps1') -AccessTokenPath $AccessTokenPath -Uri $Uri -Json | ConvertFrom-Json
    $endpointStatuses.Add([pscustomobject]@{ name = $Name; uri = $Uri; status = $response.status; error = $response.error }) | Out-Null
    if ($response.status -ne 'Succeeded') {
        $findings.Add([pscustomobject]@{
            severity = 'Medium'
            category = 'FabricRead'
            title = "Fabric endpoint unavailable: $Name"
            detail = $response.error
        }) | Out-Null
        return @()
    }
    return @(Get-FabricValues -Response $response.data)
}

if ($UseRest) {
    if (-not $AccessTokenPath -or -not (Test-Path -LiteralPath $AccessTokenPath)) {
        $findings.Add([pscustomobject]@{
            severity = 'High'
            category = 'Authentication'
            title = 'REST mode requested without token file'
            detail = 'Provide AccessTokenPath with a valid bearer token file. The plugin never signs in implicitly.'
        })
    }
    else {
        $mode = 'RestRead'
        $baseUri = 'https://api.powerbi.com/v1.0/myorg'

        if (-not $WorkspaceId) {
            $groups = Invoke-FabricGet -Uri "$baseUri/groups" -Name 'workspaces'
            if ($WorkspaceName -and $WorkspaceName -ne '[TODO: Fabric workspace]') {
                $matched = @($groups | Where-Object { $_.name -eq $WorkspaceName }) | Select-Object -First 1
                if ($matched) { $WorkspaceId = [string]$matched.id }
            }
            if (-not $WorkspaceId) {
                $findings.Add([pscustomobject]@{
                    severity = 'High'
                    category = 'Scope'
                    title = 'Workspace could not be resolved'
                    detail = 'Pass -WorkspaceId or use a unique -WorkspaceName visible to the token.'
                }) | Out-Null
            }
        }

        if ($WorkspaceId) {
            $workspaceRows = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId" -Name 'workspace'
            $reports = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/reports" -Name 'reports'
            $datasets = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/datasets" -Name 'datasets'
            $dashboards = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/dashboards" -Name 'dashboards'

            if ($workspaceRows.Count -gt 0 -and $workspaceRows[0].name) { $WorkspaceName = [string]$workspaceRows[0].name }

            foreach ($report in $reports) {
                $items += [pscustomobject]@{
                    id = $report.id
                    name = $report.name
                    type = 'Report'
                    datasetId = $report.datasetId
                    webUrl = $report.webUrl
                    configuredBy = $report.configuredBy
                }
            }

            foreach ($dataset in $datasets) {
                $refreshes = Invoke-FabricGet -Uri "$baseUri/groups/$WorkspaceId/datasets/$($dataset.id)/refreshes?`$top=5" -Name "refreshes:$($dataset.name)"
                $items += [pscustomobject]@{
                    id = $dataset.id
                    name = $dataset.name
                    type = 'SemanticModel'
                    configuredBy = $dataset.configuredBy
                    isRefreshable = $dataset.isRefreshable
                    isOnPremGatewayRequired = $dataset.isOnPremGatewayRequired
                    latestRefreshStatus = if ($refreshes.Count -gt 0) { $refreshes[0].status } else { $null }
                    refreshRecordCount = $refreshes.Count
                }
            }

            foreach ($dashboard in $dashboards) {
                $items += [pscustomobject]@{
                    id = $dashboard.id
                    name = $dashboard.displayName
                    type = 'Dashboard'
                    webUrl = $dashboard.webUrl
                    configuredBy = $dashboard.configuredBy
                }
            }
        }
    }
}

$nextActions.Add([pscustomobject]@{ phase = 'Scope'; action = "Confirm workspace name and tenant boundary: $WorkspaceName"; required = $true })
$nextActions.Add([pscustomobject]@{ phase = 'Inventory'; action = 'Collect reports, semantic models, refresh schedules, lineage, endorsements, labels, and owners.'; required = $true })
$nextActions.Add([pscustomobject]@{ phase = 'Drift'; action = 'Compare service inventory with PBIP repository artifacts before release.'; required = $true })
$nextActions.Add([pscustomobject]@{ phase = 'Governance'; action = 'Review sensitivity labels, certification state, app exposure, and refresh ownership.'; required = $true })

$result = [pscustomobject]@{
    schema = 'codex.powerbi.fabricWorkspaceInventory.v1'
    generated = (Get-Date).ToString('s')
    mode = $mode
    workspaceName = $WorkspaceName
    tenantId = $TenantId
    workspaceId = $WorkspaceId
    itemCount = @($items).Count
    items = $items
    findingCount = $findings.Count
    findings = $findings.ToArray()
    endpointStatuses = @($endpointStatuses.ToArray())
    nextActions = $nextActions.ToArray()
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Fabric Workspace Inventory',
    '',
    "Workspace: $WorkspaceName",
    "Mode: $mode",
    '',
    '## Next Actions'
) + @($nextActions | ForEach-Object { "- [$($_.phase)] $($_.action)" })

if ($findings.Count -gt 0) {
    $lines += @('', '## Findings')
    $lines += @($findings | ForEach-Object { "- [$($_.severity)] $($_.title): $($_.detail)" })
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
