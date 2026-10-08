param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scan = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -Json | ConvertFrom-Json
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$testPlan = & (Join-Path $scriptRoot 'New-PowerBIMeasureTestPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$risky = @($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 }).Count
$scores = [ordered]@{
    DaxQuality = [math]::Max(0, 100 - ($risky * 20))
    MetadataQuality = [math]::Max(0, 100 - (($catalog.metrics | Where-Object { $_.owner -match 'TODO' -or $_.businessDefinition -match 'TODO' }).Count * 10))
    PbipReadiness = [int]$structure.score
    PerformanceRisk = [math]::Max(0, 100 - ($scan.riskScore * 5))
    TestCoverage = [math]::Min(100, [int](($testPlan.testCount / [math]::Max(1, $catalog.metricCount * 3)) * 100))
}
$overall = [int](($scores.Values | Measure-Object -Average).Average)
$result = [pscustomobject]@{ schema = 'codex.powerbi.modelGovernanceScorecard.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); overallScore = $overall; scores = $scores; recommendation = $(if ($overall -ge 80) { 'Release candidate after business sign-off.' } elseif ($overall -ge 60) { 'Address high-priority findings before release.' } else { 'Stabilize model before publishing.' }) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Model Governance Scorecard', '', "Overall score: **$overall**", '', '## Scores') + @($scores.GetEnumerator() | ForEach-Object { "- $($_.Key): $($_.Value)" }) + @('', "Recommendation: $($result.recommendation)")
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

