param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$tests = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $Path -Json | ConvertFrom-Json
$rls = & (Join-Path $scriptRoot 'New-PowerBIRlsTrustReview.ps1') -Path $Path -Json | ConvertFrom-Json
$testedMeasures = @($tests.tests | ForEach-Object { ($_.measure, $_.measureName, $_.metricName | Where-Object { $_ })[0] } | Where-Object { $_ } | Select-Object -Unique)
$covered = @($catalog.metrics | Where-Object { $testedMeasures -contains $_.name }).Count
$metricCoverage = if ($catalog.metricCount -gt 0) { [math]::Round(($covered / $catalog.metricCount) * 100, 0) } else { 0 }
$executable = @($tests.tests | Where-Object { $_.status -ne 'Generated' -and $_.result -notin @('QueryGenerated','PendingLiveDax','NotRun') }).Count
$executableCoverage = if ($tests.testCount -gt 0) { [math]::Round(($executable / $tests.testCount) * 100, 0) } else { 0 }
$score = [math]::Round(($metricCoverage * 0.6) + ($executableCoverage * 0.3) + ($(if ($rls.status -eq 'Passed') { 100 } else { 0 }) * 0.1), 0)
$result = [pscustomobject]@{ schema = 'codex.powerbi.semanticTestCoverageScore.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); metricCoveragePct = $metricCoverage; executableCoveragePct = $executableCoverage; rlsCoverageStatus = $rls.status; coverageScore = $score; status = if ($score -ge 80) { 'Strong' } elseif ($score -ge 50) { 'Partial' } else { 'Weak' }; uncoveredMetrics = @($catalog.metrics | Where-Object { $testedMeasures -notcontains $_.name } | Select-Object -ExpandProperty name) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Semantic Test Coverage Score`n`nScore: **$($result.coverageScore)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
