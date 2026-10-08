param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scan = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$service = & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $Path -Json | ConvertFrom-Json
$vertipaq = & (Join-Path $scriptRoot 'Import-PowerBIVertiPaqAnalyzer.ps1') -Path $Path -Json | ConvertFrom-Json

function New-Area($Name, $Score, $Detail) {
    [pscustomobject]@{
        name = $Name
        score = [int]$Score
        level = if ($Score -ge 70) { 'High' } elseif ($Score -ge 35) { 'Medium' } else { 'Low' }
        detail = $Detail
    }
}

$measureRisk = [math]::Min(100, (@($catalog.metrics | Where-Object { $_.riskLevel -ne 'normal' }).Count * 20))
$releaseRisk = if ($service.releaseDecision -eq 'Go') { 10 } elseif ($service.releaseDecision -eq 'Warn') { 45 } else { 80 }
$areas = @(
    (New-Area 'DAX Measures' $measureRisk "Metric risks: $(@($catalog.metrics | Where-Object { $_.riskLevel -ne 'normal' }).Count)"),
    (New-Area 'Model Inspectability' ([math]::Min(100, $scan.RiskScore * 10)) "Insight risk score: $($scan.RiskScore)"),
    (New-Area 'Service Governance' ([math]::Min(100, $service.findingCount * 15)) "Service findings: $($service.findingCount)"),
    (New-Area 'Storage Model' ([math]::Min(100, $vertipaq.columnCount * 5)) "Columns inspected: $($vertipaq.columnCount)"),
    (New-Area 'Release Readiness' $releaseRisk "Release decision: $($service.releaseDecision)")
)
$overall = [int](($areas | Measure-Object -Property score -Average).Average)

$result = [pscustomobject]@{
    schema = 'codex.powerbi.modelRiskHeatmap.v1'
    generated = (Get-Date).ToString('s')
    source = (Resolve-Path -LiteralPath $Path).Path
    overallRisk = $overall
    overallLevel = if ($overall -ge 70) { 'High' } elseif ($overall -ge 35) { 'Medium' } else { 'Low' }
    areas = $areas
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @('# Model Risk Heatmap', '', "Overall risk: $overall", '', '## Areas') + @($areas | ForEach-Object { "- [$($_.level)] $($_.name): $($_.score) - $($_.detail)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
