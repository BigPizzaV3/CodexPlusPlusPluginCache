param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$risk = & (Join-Path $scriptRoot 'New-PowerBIDaxChangeRiskClassifier.ps1') -Path $Path -Json | ConvertFrom-Json
$visualImpact = & (Join-Path $scriptRoot 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $Path -Json | ConvertFrom-Json

$items = foreach ($metric in @($trust.metrics)) {
    $riskItem = @($risk.classifications | Where-Object { $_.metricName -eq $metric.name } | Select-Object -First 1)
    $impact = @($visualImpact.impacts | Where-Object { $_.measure -eq $metric.name } | Select-Object -First 1)
    $priorityScore = (100 - [int]$metric.trustScore) + (10 * [int]@($riskItem.highRiskCount)[0]) + (3 * [int]@($impact.detectedVisualReferences)[0])
    [pscustomobject]@{
        metricName = $metric.name
        trustScore = $metric.trustScore
        trustBand = $metric.trustBand
        daxRiskLevel = if ($riskItem) { $riskItem.riskLevel } else { 'Unknown' }
        visualReferenceCount = if ($impact) { $impact.detectedVisualReferences } else { 0 }
        watchPriority = if ($priorityScore -ge 50) { 'High' } elseif ($priorityScore -ge 25) { 'Medium' } else { 'Low' }
        suggestedThreshold = if ($metric.trustScore -lt 50) { 'Investigate any movement above 5% or any reconciliation mismatch.' } elseif ($metric.trustScore -lt 70) { 'Investigate movement above 10% or unexpected blank-rate changes.' } else { 'Monitor normal release baseline movement.' }
        nextCheck = 'Run metric change diagnosis with baseline/current extracts after deployment.'
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.kpiDriftWatchlist.v1'
    root = $trust.root
    generated = (Get-Date).ToString('s')
    itemCount = @($items).Count
    highPriorityCount = @($items | Where-Object { $_.watchPriority -eq 'High' }).Count
    items = @($items | Sort-Object @{Expression={ if ($_.watchPriority -eq 'High') { 0 } elseif ($_.watchPriority -eq 'Medium') { 1 } else { 2 } }}, metricName)
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI KPI Drift Watchlist', '', ('High priority: {0}' -f $result.highPriorityCount), '') + @($result.items | ForEach-Object { '- [{0}] `{1}`: trust {2}, DAX risk {3}. {4}' -f $_.watchPriority, $_.metricName, $_.trustScore, $_.daxRiskLevel, $_.suggestedThreshold })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
