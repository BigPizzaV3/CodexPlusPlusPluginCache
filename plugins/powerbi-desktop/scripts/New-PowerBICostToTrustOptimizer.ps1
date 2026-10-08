param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$capacity = & (Join-Path $scriptRoot 'New-PowerBIFabricCapacityRiskForecast.ps1') -Path $Path -Json | ConvertFrom-Json
$usage = & (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach ($metric in @($trust.metrics)) {
    $score = (100 - [int]$metric.trustScore) + $(if ($capacity.capacityRiskLevel -eq 'High') { 30 } elseif ($capacity.capacityRiskLevel -eq 'Medium') { 15 } else { 0 })
    [pscustomobject]@{ metricName = $metric.name; trustScore = $metric.trustScore; capacityRiskLevel = $capacity.capacityRiskLevel; usagePriority = $usage.priority; optimizationPriority = if ($score -ge 70) { 'High' } elseif ($score -ge 40) { 'Medium' } else { 'Low' }; recommendation = 'Prioritize low-trust, high-cost or high-usage KPIs for remediation, consolidation, or retirement review.' }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.costToTrustOptimizer.v1'; root = $trust.root; generated = (Get-Date).ToString('s'); itemCount = @($items).Count; highPriorityCount = @($items | Where-Object optimizationPriority -eq 'High').Count; items = @($items) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Cost-To-Trust Optimizer`n`nHigh priority: $($result.highPriorityCount)`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
