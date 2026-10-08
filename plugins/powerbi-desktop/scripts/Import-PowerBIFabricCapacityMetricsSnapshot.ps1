param(
    [Parameter(Mandatory)][string]$InputPath,
    [string]$OutputDirectory = 'fabric-capacity-metrics-snapshot',
    [string]$Label = 'unspecified',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
$output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $output | Out-Null

if ([IO.Path]::GetExtension($InputPath).ToLowerInvariant() -eq '.csv') {
    $rows = @(Import-Csv -LiteralPath $InputPath)
} else {
    $raw = Get-Content -Raw -LiteralPath $InputPath | ConvertFrom-Json
    $rows = if ($raw.PSObject.Properties.Name -contains 'value') { @($raw.value) } elseif ($raw.PSObject.Properties.Name -contains 'rows') { @($raw.rows) } else { @($raw) }
}

$normalized = @($rows | ForEach-Object {
    $utilization = $_.utilizationPct; if ($null -eq $utilization) { $utilization = $_.utilizationPercent }
    $throttling = $_.throttlingEvents; if ($null -eq $throttling) { $throttling = $_.throttlingCount }
    $capacityName = $_.capacityName; if (-not $capacityName) { $capacityName = $_.name }; if (-not $capacityName) { $capacityName = 'Unknown' }
    $workspaceName = $_.workspaceName; if (-not $workspaceName) { $workspaceName = $_.workspace }; if (-not $workspaceName) { $workspaceName = 'Unknown' }
    $itemName = $_.itemName; if (-not $itemName) { $itemName = $_.item }; if (-not $itemName) { $itemName = 'Unknown' }
    $operation = $_.operation; if (-not $operation) { $operation = $_.operationType }; if (-not $operation) { $operation = 'Unknown' }
    $timestamp = $_.timestamp; if (-not $timestamp) { $timestamp = $_.timepoint }
    $cu = $_.cu; if ($null -eq $cu) { $cu = $_.cuConsumption }
    [pscustomobject]@{
        capacityName = [string]$capacityName; workspaceName = [string]$workspaceName; itemName = [string]$itemName; operation = [string]$operation; timestamp = [string]$timestamp
        cu = [double]$cu; utilizationPct = [double]$utilization; throttlingEvents = [int]$throttling
        sourceLabel = $Label
    }
})
$snapshotPath = Join-Path $output 'capacity-metrics.json'
$normalized | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $snapshotPath -Encoding UTF8
$summary = [pscustomobject]@{
    schema = 'codex.powerbi.fabricCapacityMetricsSnapshot.v1'; generated = (Get-Date).ToString('s'); label = $Label; inputPath = (Resolve-Path -LiteralPath $InputPath).Path; outputDirectory = $output; rowCount = $normalized.Count; totalCu = [math]::Round((@($normalized | Measure-Object cu -Sum).Sum),2); throttlingEventCount = [int](@($normalized | Measure-Object throttlingEvents -Sum).Sum); capacityCount = @($normalized.capacityName | Select-Object -Unique).Count; evidenceMaturity = 'ImportedSnapshot'
}
$summaryPath = Join-Path $output 'summary.json'; $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$result = [pscustomobject]@{ OutputDirectory = $output; Snapshot = $snapshotPath; Summary = $summaryPath; RowCount = $normalized.Count }
if ($Json) { $result | ConvertTo-Json -Depth 5 } else { $result }
