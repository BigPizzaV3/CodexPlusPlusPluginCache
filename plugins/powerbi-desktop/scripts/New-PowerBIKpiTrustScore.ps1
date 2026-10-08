param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$impact = & (Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json | ConvertFrom-Json
$testPlan = & (Join-Path $scriptRoot 'New-PowerBIMeasureTestPlan.ps1') -Path $Path -Json | ConvertFrom-Json

$metrics = foreach ($metric in @($catalog.metrics)) {
    $impactItem = @($impact.measures | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    $tests = @($testPlan.tests | Where-Object { $_.measure -eq $metric.name })
    $score = 100
    $deductions = New-Object System.Collections.Generic.List[string]
    if (@($metric.risks).Count -gt 0) { $score -= 25; $deductions.Add('DAX risk detected') }
    if ($metric.owner -match 'TODO') { $score -= 15; $deductions.Add('Metric owner missing') }
    if ($metric.businessDefinition -match 'TODO') { $score -= 15; $deductions.Add('Business definition missing') }
    if ($impactItem.downstreamCount -gt 0) { $score -= [math]::Min(15, $impactItem.downstreamCount * 5); $deductions.Add('Downstream dependency impact') }
    if ($tests.Count -lt 3) { $score -= 10; $deductions.Add('Generated test coverage below baseline') }
    $score = [math]::Max(0, [int]$score)
    [pscustomobject]@{
        id = $metric.id
        name = $metric.name
        table = $metric.table
        trustScore = $score
        trustBand = $(if ($score -ge 80) { 'High' } elseif ($score -ge 60) { 'Medium' } else { 'Low' })
        deductions = @($deductions.ToArray())
        riskCount = @($metric.risks).Count
        downstreamCount = $impactItem.downstreamCount
        generatedTestCount = $tests.Count
        releaseUse = $(if ($score -ge 80) { 'Approved candidate after business sign-off.' } elseif ($score -ge 60) { 'Use with warning and validation note.' } else { 'Do not use for executive release without remediation.' })
    }
}
$overall = [int]((@($metrics | Select-Object -ExpandProperty trustScore) | Measure-Object -Average).Average)
$result = [pscustomobject]@{ schema = 'codex.powerbi.kpiTrustScore.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); metricCount = @($metrics).Count; overallTrustScore = $overall; metrics = @($metrics | Sort-Object trustScore, name) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI KPI Trust Score', '', "Overall trust score: **$overall**", '') + @($result.metrics | ForEach-Object { "## $($_.name)`n- Trust score: $($_.trustScore) ($($_.trustBand))`n- Deductions: $(if ($_.deductions.Count) { $_.deductions -join '; ' } else { 'none' })`n- Release use: $($_.releaseUse)`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

