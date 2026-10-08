param(
    [string]$Path = ".",
    [string]$ReviewDirectory,
    [ValidateSet('Executive', 'Technical')]
    [string]$Audience = 'Executive',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path

function Test-HasProperty {
    param([object]$Object, [string]$Name)
    return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Read-JsonIfExists {
    param([string]$FilePath)
    if ($FilePath -and (Test-Path -LiteralPath $FilePath)) {
        return (Get-Content -Raw -LiteralPath $FilePath | ConvertFrom-Json)
    }
    return $null
}

$reviewRoot = $null
if ($ReviewDirectory -and (Test-Path -LiteralPath $ReviewDirectory)) {
    $reviewRoot = (Resolve-Path -LiteralPath $ReviewDirectory).Path
}

$methodologyPath = if ($reviewRoot) { Join-Path $reviewRoot 'analysis-methodology-validation.json' } else { $null }
$methodology = Read-JsonIfExists $methodologyPath
if (-not $methodology) {
    $methodology = & (Join-Path $scriptRoot 'Test-PowerBIAnalysisMethodology.ps1') -Path $root -ReviewDirectory $reviewRoot -Json | ConvertFrom-Json
}

$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $root -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $root -Json | ConvertFrom-Json
$releaseGate = if ($reviewRoot) { Read-JsonIfExists (Join-Path $reviewRoot 'trust-release-gate.json') } else { $null }
if (-not $releaseGate) {
    $releaseGate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $root -Json | ConvertFrom-Json
}
$riskHeatmap = if ($reviewRoot) { Read-JsonIfExists (Join-Path $reviewRoot 'model-risk-heatmap.json') } else { $null }
if (-not $riskHeatmap) {
    $riskHeatmap = & (Join-Path $scriptRoot 'New-PowerBIModelRiskHeatmap.ps1') -Path $root -Json | ConvertFrom-Json
}

$topRiskMetrics = @($trust.metrics | Sort-Object trustScore, name | Select-Object -First 5)
$methodologyFindings = @($methodology.findings | Sort-Object @{ Expression = { if ($_.severity -eq 'High') { 0 } elseif ($_.severity -eq 'Medium') { 1 } else { 2 } } }, category | Select-Object -First 6)

$decision = if (Test-HasProperty $releaseGate 'decision') { $releaseGate.decision } else { 'Unknown' }
$risk = if (Test-HasProperty $riskHeatmap 'overallRisk') { $riskHeatmap.overallRisk } elseif (Test-HasProperty $riskHeatmap 'riskLevel') { $riskHeatmap.riskLevel } else { 'Unknown' }

$markdownLines = New-Object System.Collections.Generic.List[string]
$markdownLines.Add('# Power BI Analytical Release Report')
$markdownLines.Add('')
$markdownLines.Add(('Audience: {0}' -f $Audience))
$markdownLines.Add(('Source: `{0}`' -f $root))
$markdownLines.Add('')
$markdownLines.Add('## Executive Summary')
$markdownLines.Add('')
$markdownLines.Add(('- **Release decision:** {0}.' -f $decision))
$markdownLines.Add(('- **Methodology assessment:** {0}.' -f $methodology.assessment))
$markdownLines.Add(('- **KPI trust:** overall score {0} across {1} metrics.' -f $trust.overallTrustScore, $trust.metricCount))
$markdownLines.Add(('- **Semantic validation:** {0} tests, {1} failed, {2} pending/generated.' -f $semantic.testCount, $semantic.failedCount, $methodology.checks.pendingSemanticTestCount))
$markdownLines.Add('')
$markdownLines.Add('## Release Readiness')
$markdownLines.Add('')
$markdownLines.Add(('The current release posture is **{0}** with model risk **{1}**. Methodology validation is **{2}**, so stakeholder sharing should follow that assessment rather than treating generated review artifacts as automatically final.' -f $decision, $risk, $methodology.assessment))
$markdownLines.Add('')
$markdownLines.Add('## KPI Trust Findings')
$markdownLines.Add('')
foreach ($metric in $topRiskMetrics) {
    $deductions = if (@($metric.deductions).Count -gt 0) { $metric.deductions -join '; ' } else { 'none' }
    $markdownLines.Add(('- **{0}:** trust score {1} ({2}); deductions: {3}.' -f $metric.name, $metric.trustScore, $metric.trustBand, $deductions))
}
$markdownLines.Add('')
$markdownLines.Add('## Methodology And Data Quality Caveats')
$markdownLines.Add('')
if ($methodologyFindings.Count -eq 0) {
    $markdownLines.Add('- No material methodology caveats were detected from local evidence.')
}
else {
    foreach ($finding in $methodologyFindings) {
        $markdownLines.Add(('- [{0}] {1}: {2}' -f $finding.severity, $finding.category, $finding.message))
    }
}
$markdownLines.Add('')
$markdownLines.Add('## Recommended Next Actions')
$markdownLines.Add('')
if ($methodology.assessment -eq 'NeedsRevision') {
    $markdownLines.Add('- Resolve High methodology findings before treating this as a release-ready stakeholder report.')
}
elseif ($methodology.assessment -eq 'ShareWithCaveats') {
    $markdownLines.Add('- Share only with explicit caveats for generated semantic tests, missing definitions, and unresolved trust items.')
}
else {
    $markdownLines.Add('- Confirm owner sign-off and preserve the generated evidence pack with the release record.')
}
$markdownLines.Add('- Run metric change diagnosis for any KPI that materially changed, is low trust, or drives the release decision.')

$markdown = ($markdownLines -join [Environment]::NewLine) + [Environment]::NewLine

$result = [pscustomobject]@{
    schema = 'codex.powerbi.analyticalReleaseReport.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    reviewDirectory = $reviewRoot
    audience = $Audience
    releaseDecision = $decision
    methodologyAssessment = $methodology.assessment
    overallTrustScore = $trust.overallTrustScore
    metricCount = $trust.metricCount
    semanticTestCount = $semantic.testCount
    semanticFailedCount = $semantic.failedCount
    pendingSemanticTestCount = $methodology.checks.pendingSemanticTestCount
    topRiskMetrics = @($topRiskMetrics)
    methodologyFindings = @($methodologyFindings)
    markdown = $markdown
    outputPath = if ($OutputPath) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath) } else { $null }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8 }
$markdown
