param(
    [string]$Path = ".",
    [string]$UsageSignalsPath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolved = (Resolve-Path -LiteralPath $Path).Path

function Read-JsonFile {
    param([string]$LiteralPath)
    if ($LiteralPath -and (Test-Path -LiteralPath $LiteralPath)) {
        $raw = Get-Content -Raw -LiteralPath $LiteralPath
        if ($raw.Trim().StartsWith('{') -or $raw.Trim().StartsWith('[')) {
            return ($raw | ConvertFrom-Json)
        }
    }
    $null
}

function Normalize-Key {
    param([string]$Value)
    if (-not $Value) { return '' }
    ($Value.ToLowerInvariant() -replace '[^a-z0-9]', '')
}

$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $resolved -Json | ConvertFrom-Json
if (@($trust.metrics).Count -eq 0) {
    $liveCatalogPath = Join-Path $resolved 'live-metric-catalog.json'
    if (Test-Path -LiteralPath $liveCatalogPath) {
        $liveCatalog = Get-Content -Raw -LiteralPath $liveCatalogPath | ConvertFrom-Json
        $liveMetrics = foreach ($metric in @($liveCatalog.metrics)) {
            $score = 100
            $deductions = New-Object System.Collections.Generic.List[string]
            if (@($metric.risks).Count -gt 0) { $score -= 25; $deductions.Add('DAX risk detected') }
            if ($metric.owner -match 'TODO') { $score -= 15; $deductions.Add('Metric owner missing') }
            if ($metric.businessDefinition -match 'TODO') { $score -= 15; $deductions.Add('Business definition missing') }
            $score = [math]::Max(0, [int]$score)
            [pscustomobject]@{
                name = $metric.name
                table = $metric.table
                trustScore = $score
                trustBand = $(if ($score -ge 80) { 'High' } elseif ($score -ge 60) { 'Medium' } else { 'Low' })
                releaseUse = $(if ($score -ge 80) { 'Approved candidate after business sign-off.' } elseif ($score -ge 60) { 'Use with warning and validation note.' } else { 'Do not use for executive release without remediation.' })
            }
        }
        $trust = [pscustomobject]@{
            schema = 'codex.powerbi.kpiTrustScore.liveCatalogFallback.v1'
            metrics = @($liveMetrics)
            overallTrustScore = if (@($liveMetrics).Count -gt 0) { [int]((@($liveMetrics | Select-Object -ExpandProperty trustScore) | Measure-Object -Average).Average) } else { 0 }
        }
    }
}
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $resolved -Json | ConvertFrom-Json
$service = & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $resolved -Json | ConvertFrom-Json
$usage = Read-JsonFile -LiteralPath $UsageSignalsPath
if (-not $usage) {
    $usage = & (Join-Path $scriptRoot 'Import-PowerBIUsageSignals.ps1') -Path $resolved -Json | ConvertFrom-Json
}

$usageByKey = @{}
foreach ($item in @($usage.reportUsage)) {
    $key = Normalize-Key $item.reportName
    if ($key) { $usageByKey[$key] = $item }
}
$maxUsage = @($usage.reportUsage | Sort-Object @{ Expression = 'viewCount'; Descending = $true }, @{ Expression = 'activityCount'; Descending = $true } | Select-Object -First 1)

$matrixItems = foreach ($metric in @($trust.metrics)) {
    $metricKey = Normalize-Key $metric.name
    $usageItem = $null
    foreach ($key in $usageByKey.Keys) {
        if ($key.Contains($metricKey) -or $metricKey.Contains($key)) {
            $usageItem = $usageByKey[$key]
            break
        }
    }
    if (-not $usageItem -and $maxUsage) { $usageItem = $maxUsage }
    $activity = if ($usageItem) { [int]$usageItem.activityCount } else { 0 }
    $views = if ($usageItem) { [int]$usageItem.viewCount } else { 0 }
    $usageBand = if ($views -ge 100 -or $activity -ge 50) { 'High' } elseif ($views -ge 10 -or $activity -ge 10) { 'Medium' } elseif ($activity -gt 0 -or $views -gt 0) { 'Low' } else { 'Unknown' }
    $priority = if ($metric.trustScore -lt 60 -and $usageBand -eq 'High') { 'P0' } elseif ($metric.trustScore -lt 60 -and $usageBand -in @('Medium', 'Low', 'Unknown')) { 'P1' } elseif ($metric.trustScore -lt 80 -and $usageBand -eq 'High') { 'P1' } else { 'P2' }
    [pscustomobject]@{
        metricName = $metric.name
        table = $metric.table
        trustScore = $metric.trustScore
        trustBand = $metric.trustBand
        usageBand = $usageBand
        activityCount = $activity
        viewCount = $views
        matchedUsageItem = if ($usageItem) { $usageItem.reportName } else { $null }
        priority = $priority
        releaseUse = $metric.releaseUse
    }
}

$highUsageLowTrust = @($matrixItems | Where-Object { $_.trustScore -lt 60 -and $_.usageBand -in @('High', 'Medium') } | Sort-Object priority, trustScore)
if ($highUsageLowTrust.Count -eq 0) {
    $highUsageLowTrust = @($matrixItems | Where-Object { $_.trustScore -lt 60 } | Sort-Object trustScore | Select-Object -First 10)
}

$overallPriority = if (@($highUsageLowTrust | Where-Object priority -eq 'P0').Count -gt 0 -or $gate.decision -eq 'No-Go') { 'P0' } elseif ($gate.decision -eq 'Warn' -or $highUsageLowTrust.Count -gt 0) { 'P1' } else { 'P2' }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.usageTrustMatrix.v1'
    generated = (Get-Date).ToString('s')
    source = $resolved
    usageSignalsPath = $UsageSignalsPath
    releaseDecision = $gate.decision
    serviceFindingCount = $service.findingCount
    usageStatus = $usage.status
    priority = $overallPriority
    metricCount = @($matrixItems).Count
    highUsageLowTrustCount = $highUsageLowTrust.Count
    highUsageLowTrust = @($highUsageLowTrust)
    matrixItems = @($matrixItems)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Power BI Usage Trust Matrix',
    '',
    "Priority: $overallPriority",
    "Release decision: $($gate.decision)",
    "Usage status: $($usage.status)",
    '',
    '## High usage / low trust'
) + @($highUsageLowTrust | ForEach-Object { "- [$($_.priority)] $($_.metricName): trust=$($_.trustScore), usage=$($_.usageBand), views=$($_.viewCount), activities=$($_.activityCount)" })

if ($highUsageLowTrust.Count -eq 0) {
    $lines += '- No high-usage low-trust KPI candidates found.'
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
