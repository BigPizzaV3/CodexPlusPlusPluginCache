param([string]$Path = '.', [string]$SloConfigPath, [string]$OutputPath, [switch]$Json)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SloConfigPath) { $SloConfigPath = Join-Path $scriptRoot '../rules/powerbi-kpi-slos.json' }
if (-not (Test-Path -LiteralPath $SloConfigPath)) { throw "SLO configuration not found: $SloConfigPath" }
$config = Get-Content -Raw -LiteralPath $SloConfigPath | ConvertFrom-Json
if ($config.schema -ne 'codex.powerbi.kpiSlos.v1') { throw 'Unsupported KPI SLO configuration schema.' }

$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$freshness = & (Join-Path $scriptRoot 'Test-PowerBIDataFreshnessLineageGate.ps1') -Path $Path -Json | ConvertFrom-Json
$drift = & (Join-Path $scriptRoot 'New-PowerBIKpiDriftWatchlist.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach ($metric in @($trust.metrics)) {
    $rule = @($config.kpis | Where-Object metricName -eq $metric.name | Select-Object -First 1)
    $watch = @($drift.items | Where-Object metricName -eq $metric.name | Select-Object -First 1)
    $causes = New-Object System.Collections.Generic.List[string]
    if (-not $rule) { $causes.Add('No KPI-specific SLO owner configuration.') | Out-Null }
    if ($metric.trustScore -lt 70) { $causes.Add("Trust score is $($metric.trustScore).") | Out-Null }
    if ($freshness.status -in @('Blocked','Warn')) { $causes.Add("Freshness status is $($freshness.status).") | Out-Null }
    if ($watch -and $watch.watchPriority -eq 'High') { $causes.Add('High-priority KPI drift watch.') | Out-Null }
    $status = if (-not $rule) { 'NeedsOwnerSetup' } elseif ($causes.Count -gt 0) { 'ActionRequired' } else { 'OnTrack' }
    $priority = if (-not $rule) { 'High' } elseif ($rule.decisionCritical -and $status -eq 'ActionRequired') { 'High' } elseif ($status -eq 'ActionRequired') { 'Medium' } else { 'Low' }
    [pscustomobject]@{
        metricName = $metric.name; owner = if ($rule) { $rule.owner } else { $null }; decisionCritical = if ($rule) { [bool]$rule.decisionCritical } else { $false }
        freshnessTargetHours = if ($rule) { $rule.freshnessTargetHours } else { $config.default.freshnessTargetHours }; severity = if ($rule) { $rule.severity } else { $config.default.severity }
        status = $status; priority = $priority; causes = @($causes); nextAction = if ($rule) { $rule.actionHint } else { 'Assign KPI owner and define a KPI-specific SLO.' }
    }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.kpiSloActionList.v1'; generated = (Get-Date).ToString('s'); root = $trust.root; itemCount = @($items).Count; actionRequiredCount = @($items | Where-Object status -eq 'ActionRequired').Count; needsOwnerSetupCount = @($items | Where-Object status -eq 'NeedsOwnerSetup').Count; items = @($items) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# KPI SLO Action List`n`nAction required: $($result.actionRequiredCount)`nOwner setup required: $($result.needsOwnerSetupCount)`n"; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }; $content
