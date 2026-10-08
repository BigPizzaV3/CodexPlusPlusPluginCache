param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$freshness = & (Join-Path $scriptRoot 'Test-PowerBIDataFreshnessLineageGate.ps1') -Path $Path -Json | ConvertFrom-Json
$drift = & (Join-Path $scriptRoot 'New-PowerBIKpiDriftWatchlist.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach ($metric in @($trust.metrics)) {
    $watch = @($drift.items | Where-Object metricName -eq $metric.name | Select-Object -First 1)
    [pscustomobject]@{ metricName = $metric.name; owner = (($metric.owner, '[TODO: metric owner]' | Where-Object { $_ })[0]); trustScore = $metric.trustScore; freshnessStatus = $freshness.status; driftPriority = if ($watch) { $watch.watchPriority } else { 'Unknown' }; slaStatus = if ($metric.trustScore -lt 50 -or $freshness.status -eq 'Blocked') { 'Breached' } elseif ($metric.trustScore -lt 70 -or $freshness.status -eq 'Warn') { 'AtRisk' } else { 'WithinSla' }; nextAction = 'Confirm owner, freshness SLA, test evidence, and drift threshold.' }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.businessKpiSlaMonitor.v1'; root = $trust.root; generated = (Get-Date).ToString('s'); itemCount = @($items).Count; breachedCount = @($items | Where-Object slaStatus -eq 'Breached').Count; atRiskCount = @($items | Where-Object slaStatus -eq 'AtRisk').Count; items = @($items) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Business KPI SLA Monitor`n`nBreached: $($result.breachedCount)`nAt risk: $($result.atRiskCount)`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
