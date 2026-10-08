param(
    [string]$Path = ".",
    [Parameter(Mandatory = $true)]
    [string]$MetricName,
    [string]$BaselinePath,
    [string]$CurrentPath,
    [string]$ComparisonLabel = 'baseline vs current',
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

function Select-ByMetric {
    param([object[]]$Items, [string]$Name)
    @($Items | Where-Object {
        (Test-HasProperty $_ 'measure' -and $_.measure -eq $Name) -or
        (Test-HasProperty $_ 'name' -and $_.name -eq $Name) -or
        (Test-HasProperty $_ 'id' -and $_.id -like ('*' + ($Name.ToLowerInvariant().Replace(' ', '-').Replace('%', 'pct')) + '*'))
    })
}

$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $root -Json | ConvertFrom-Json
$dependency = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $root -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $root -Json | ConvertFrom-Json

$metric = @($catalog.metrics | Where-Object { $_.name -eq $MetricName } | Select-Object -First 1)
$trustMetric = @($trust.metrics | Where-Object { $_.name -eq $MetricName } | Select-Object -First 1)
$semanticChecks = Select-ByMetric -Items @($semantic.tests) -Name $MetricName
$dependencyEdges = @()
if (Test-HasProperty $dependency 'edges') {
    $dependencyEdges = @($dependency.edges | Where-Object { $_.from -like "*$MetricName*" -or $_.to -like "*$MetricName*" })
}

$behaviorComparison = $null
$comparisonItems = @()
if ($BaselinePath -and $CurrentPath -and (Test-Path -LiteralPath $BaselinePath) -and (Test-Path -LiteralPath $CurrentPath)) {
    $behaviorComparison = & (Join-Path $scriptRoot 'Compare-PowerBIMeasureBehavior.ps1') -Path $root -BaselineResultsPath $BaselinePath -CurrentResultsPath $CurrentPath -Json | ConvertFrom-Json
    $comparisonItems = Select-ByMetric -Items @($behaviorComparison.comparisons) -Name $MetricName
}

$measurementRisks = New-Object System.Collections.Generic.List[string]
$likelyDrivers = New-Object System.Collections.Generic.List[string]
$unresolvedGaps = New-Object System.Collections.Generic.List[string]
$nextChecks = New-Object System.Collections.Generic.List[string]

if (-not $metric) {
    $measurementRisks.Add('Metric is not present in the local metric catalog.')
    $unresolvedGaps.Add('No DAX expression, source file, trust score, or semantic test can be tied to the requested metric name.')
    $nextChecks.Add('Confirm the metric display name or export the report as PBIP/TMDL/DAX before rerunning diagnosis.')
}
else {
    if (@($metric.risks).Count -gt 0) {
        foreach ($risk in @($metric.risks)) { $measurementRisks.Add($risk) }
        $likelyDrivers.Add('DAX expression risk may contribute to movement or mismatch; validate the expression and filter context.')
    }
    if ($metric.expression -match '(?i)SAMEPERIODLASTYEAR|DATEADD|PREVIOUSYEAR|PARALLELPERIOD|YTD|DATESYTD') {
        $likelyDrivers.Add('Time-intelligence logic can explain movement when comparison periods, calendars, or partial periods differ.')
    }
    if ($metric.expression -match '(?i)DIVIDE\s*\(') {
        $likelyDrivers.Add('Ratio denominator movement may explain the change; inspect numerator and denominator separately.')
    }
    if ($metric.expression -match '(?i)ALL\s*\(|REMOVEFILTERS\s*\(') {
        $likelyDrivers.Add('Filter-removal logic may create differences between visual context and expected business filters.')
    }
    if ($dependencyEdges.Count -gt 0) {
        $likelyDrivers.Add("Dependency graph shows $($dependencyEdges.Count) related edge(s); upstream measure movement may explain the metric.")
    }
    if ($trustMetric -and $trustMetric.trustScore -lt 80) {
        $measurementRisks.Add("Trust score is $($trustMetric.trustScore), which requires caveated release use.")
    }
    if ($semanticChecks.Count -eq 0) {
        $unresolvedGaps.Add('No semantic test is tied to this metric.')
        $nextChecks.Add('Create or provide measure expectations for the metric.')
    }
    elseif (@($semanticChecks | Where-Object { $_.result -in @('PendingLiveDax', 'QueryGenerated', 'NotRun') -or $_.status -eq 'Generated' }).Count -gt 0) {
        $measurementRisks.Add('Metric has generated or pending semantic checks rather than validated results.')
        $nextChecks.Add('Validate the metric through live DAX or reviewed result files.')
    }
}

if ($BaselinePath -or $CurrentPath) {
    if (-not ($BaselinePath -and $CurrentPath)) {
        $unresolvedGaps.Add('Only one comparison result file was supplied.')
        $nextChecks.Add('Supply both baseline and current result files to quantify movement.')
    }
    elseif ($comparisonItems.Count -eq 0) {
        $unresolvedGaps.Add('Baseline/current files did not contain a matching metric/context row.')
        $nextChecks.Add('Confirm result file measure names and filter contexts.')
    }
    elseif (@($comparisonItems | Where-Object status -eq 'Failed').Count -gt 0) {
        $likelyDrivers.Add('Baseline/current result comparison shows a value difference beyond tolerance.')
    }
}
else {
    $unresolvedGaps.Add('No baseline/current result files were supplied, so the pattern is a diagnostic plan rather than a quantified movement.')
    $nextChecks.Add('Export baseline and current semantic test results or compare live Desktop targets to quantify the change.')
}

if ($likelyDrivers.Count -eq 0) { $likelyDrivers.Add('No specific driver is verified from local evidence; this is a source-evidence gap, not proof of stability.') }
if ($measurementRisks.Count -eq 0) { $measurementRisks.Add('No material measurement risks detected from local metadata.') }
if ($nextChecks.Count -eq 0) { $nextChecks.Add('Review owner sign-off and stakeholder caveats before release use.') }

$evidenceStrength = if (-not $metric) { 'Low' } elseif ($comparisonItems.Count -gt 0 -and $semanticChecks.Count -gt 0) { 'High' } elseif ($semanticChecks.Count -gt 0 -or $trustMetric) { 'Medium' } else { 'Low' }
$status = if (-not $metric) { 'MetricNotFound' } elseif ($comparisonItems.Count -gt 0) { 'Diagnosed' } else { 'NeedsComparisonEvidence' }

$result = [pscustomobject]@{
    schema = 'codex.powerbi.metricChangeDiagnosis.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    metricName = $MetricName
    status = $status
    comparisonLabel = $ComparisonLabel
    evidenceStrength = $evidenceStrength
    verifiedPattern = if ($comparisonItems.Count -gt 0) { 'Baseline/current result files were compared for the requested metric.' } elseif ($metric) { 'Metric metadata was found, but movement was not quantified.' } else { 'Metric was not found in local metadata.' }
    metric = if ($metric) { [pscustomobject]@{ name = $metric.name; table = $metric.table; source = $metric.source; tags = $metric.tags; riskLevel = $metric.riskLevel } } else { $null }
    trust = if ($trustMetric) { [pscustomobject]@{ trustScore = $trustMetric.trustScore; trustBand = $trustMetric.trustBand; deductions = $trustMetric.deductions } } else { $null }
    semanticCheckCount = $semanticChecks.Count
    dependencyEdgeCount = $dependencyEdges.Count
    comparisonCount = $comparisonItems.Count
    comparisons = @($comparisonItems)
    likelyDrivers = @($likelyDrivers)
    measurementRisks = @($measurementRisks)
    unresolvedGaps = @($unresolvedGaps)
    recommendedNextChecks = @($nextChecks)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Power BI Metric Change Diagnosis',
    '',
    "Metric: **$MetricName**",
    "Status: $($result.status)",
    "Evidence strength: $($result.evidenceStrength)",
    '',
    '## Verified Pattern',
    '',
    $result.verifiedPattern,
    '',
    '## Likely Drivers'
) + @($likelyDrivers | ForEach-Object { "- $_" }) + @(
    '',
    '## Measurement Risks'
) + @($measurementRisks | ForEach-Object { "- $_" }) + @(
    '',
    '## Unresolved Gaps'
) + @($unresolvedGaps | ForEach-Object { "- $_" }) + @(
    '',
    '## Recommended Next Checks'
) + @($nextChecks | ForEach-Object { "- $_" })

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
