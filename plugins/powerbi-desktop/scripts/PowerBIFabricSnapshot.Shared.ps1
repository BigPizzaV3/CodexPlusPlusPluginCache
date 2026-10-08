function Resolve-FabricSnapshotDirectory {
    param([string]$SnapshotDirectory, [string]$DefaultName = 'minimal')
    if ($SnapshotDirectory -and (Test-Path -LiteralPath $SnapshotDirectory)) {
        return (Resolve-Path -LiteralPath $SnapshotDirectory).Path
    }
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $candidate = Join-Path (Split-Path -Parent $scriptRoot) "examples/fabric-snapshot/$DefaultName"
    if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
    return $null
}

function Read-FabricSnapshotFile {
    param([string]$SnapshotRoot, [string]$Name, $Fallback = @())
    if (-not $SnapshotRoot) { return $Fallback }
    $path = Join-Path $SnapshotRoot $Name
    if (Test-Path -LiteralPath $path) {
        $raw = Get-Content -Raw -LiteralPath $path
        if ([string]::IsNullOrWhiteSpace($raw)) { return $Fallback }
        return $raw | ConvertFrom-Json
    }
    return $Fallback
}

function Get-FabricSnapshot {
    param([string]$SnapshotDirectory, [string]$DefaultName = 'minimal')
    $root = Resolve-FabricSnapshotDirectory -SnapshotDirectory $SnapshotDirectory -DefaultName $DefaultName
    $workspace = Read-FabricSnapshotFile -SnapshotRoot $root -Name 'workspace.json' -Fallback ([pscustomobject]@{ id = $null; name = 'Unknown Fabric workspace'; owners = @() })
    [pscustomobject]@{
        root = $root
        workspace = $workspace
        items = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'items.json' -Fallback @())
        reports = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'reports.json' -Fallback @())
        semanticModels = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'semantic-models.json' -Fallback @())
        refreshHistory = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'refresh-history.json' -Fallback @())
        lineage = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'lineage.json' -Fallback @())
        deploymentPipelines = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'deployment-pipelines.json' -Fallback @())
        capacities = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'capacities.json' -Fallback @())
        gateways = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'gateways.json' -Fallback @())
        activity = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'activity.json' -Fallback @())
        endorsements = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'endorsements.json' -Fallback @())
        sensitivityLabels = @(Read-FabricSnapshotFile -SnapshotRoot $root -Name 'sensitivity-labels.json' -Fallback @())
    }
}

function Write-FabricResult {
    param($Result, [string]$OutputPath, [switch]$Json)
    if ($Json) {
        $text = $Result | ConvertTo-Json -Depth 12
        if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
        $text
        return
    }
    $lines = @("# $($Result.title)", '', "Status: **$($Result.status)**")
    if ($Result.findings) {
        $lines += @('', '## Findings')
        $lines += @($Result.findings | ForEach-Object { "- [$($_.severity)] $($_.area): $($_.message)" })
    }
    $content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
    $content
}

function New-FabricFinding {
    param([string]$Severity, [string]$Area, [string]$Message)
    [pscustomobject]@{ severity = $Severity; area = $Area; message = $Message }
}
