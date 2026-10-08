param(
    [string]$Path = ".",
    [string]$MeasureName,
    [string]$BeforePath,
    [string]$AfterPath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path

function Invoke-JsonScript {
    param([string]$ScriptName, [hashtable]$Arguments)
    $scriptPath = Join-Path $scriptRoot $ScriptName
    $cmdArgs = @{}
    foreach ($key in $Arguments.Keys) {
        if ($null -ne $Arguments[$key] -and $Arguments[$key] -ne '') {
            $cmdArgs[$key] = $Arguments[$key]
        }
    }
    & $scriptPath @cmdArgs -Json | ConvertFrom-Json
}

function Add-TimelineEvent {
    param(
        [System.Collections.Generic.List[object]]$Timeline,
        [string]$Stage,
        [string]$Signal,
        [string]$Detail
    )
    $Timeline.Add([pscustomobject]@{
        timestamp = (Get-Date).ToString('s')
        stage = $Stage
        signal = $Signal
        detail = $Detail
    })
}

function Get-MetricCatalogWithLiveFallback {
    param([string]$ProjectPath, [string]$RootPath)

    $catalogResult = Invoke-JsonScript -ScriptName 'New-PowerBIMetricCatalog.ps1' -Arguments @{ Path = $ProjectPath }
    if (@($catalogResult.metrics).Count -gt 0) { return $catalogResult }

    $liveCatalogPath = Join-Path $RootPath 'live-metric-catalog.json'
    if (-not (Test-Path -LiteralPath $liveCatalogPath)) { return $catalogResult }

    $liveCatalog = Get-Content -Raw -LiteralPath $liveCatalogPath | ConvertFrom-Json
    [pscustomobject]@{
        schema = 'codex.powerbi.metricCatalog.liveCatalogFallback.v1'
        root = $RootPath
        metricCount = @($liveCatalog.metrics).Count
        metrics = @($liveCatalog.metrics | ForEach-Object {
            [pscustomobject]@{
                id = $_.id
                name = $_.name
                table = $_.table
                source = $_.source
                expression = $_.expression
                risks = @($_.risks)
            }
        })
    }
}

$catalog = Get-MetricCatalogWithLiveFallback -ProjectPath $Path -RootPath $root
$trust = Invoke-JsonScript -ScriptName 'New-PowerBIKpiTrustScore.ps1' -Arguments @{ Path = $Path }
$rootCauseGraph = Invoke-JsonScript -ScriptName 'New-PowerBIBrokenMeasureRootCauseGraph.ps1' -Arguments @{ Path = $Path }
$flightRecorder = $null
try {
    $flightRecorder = Invoke-JsonScript -ScriptName 'New-PowerBIFlightRecorder.ps1' -Arguments @{ Path = $Path }
}
catch {
    $flightRecorder = [pscustomobject]@{ schema = 'codex.powerbi.flightRecorder.unavailable'; error = $_.Exception.Message }
}

$comparison = $null
if ($BeforePath -and $AfterPath) {
    try {
        $comparison = Invoke-JsonScript -ScriptName 'Compare-PowerBIMeasureBehavior.ps1' -Arguments @{ Path = $Path; BeforePath = $BeforePath; AfterPath = $AfterPath }
    }
    catch {
        $comparison = [pscustomobject]@{ schema = 'codex.powerbi.measureBehaviorComparison.unavailable'; status = 'Unavailable'; error = $_.Exception.Message; comparisons = @() }
    }
}

$selectedMetrics = @($catalog.metrics)
if ($MeasureName) {
    $selectedMetrics = @($selectedMetrics | Where-Object { $_.name -eq $MeasureName -or $_.id -eq $MeasureName })
}
if (-not $MeasureName) {
    $selectedNames = @(
        @($trust.metrics | Where-Object { $_.trustScore -lt 80 } | Select-Object -ExpandProperty name)
        @($rootCauseGraph.rootCauses | Select-Object -ExpandProperty measure)
        @($comparison.comparisons | Where-Object { $_.status -ne 'Passed' } | ForEach-Object { if ($_.measure) { $_.measure } elseif ($_.id) { ($_.id -split '\.')[-1] -replace '-', ' ' } })
    ) | Where-Object { $_ } | Sort-Object -Unique
    if ($selectedNames.Count -gt 0) {
        $selectedMetrics = @($catalog.metrics | Where-Object { $_.name -in $selectedNames })
    }
}

$timeline = New-Object System.Collections.Generic.List[object]
Add-TimelineEvent -Timeline $timeline -Stage 'Catalog' -Signal 'MetricCatalog' -Detail ('Cataloged {0} measures from {1}.' -f $catalog.metricCount, $catalog.root)
Add-TimelineEvent -Timeline $timeline -Stage 'Trust' -Signal 'KpiTrustScore' -Detail ('Overall trust score {0}; selected affected measures {1}.' -f $trust.overallTrustScore, @($selectedMetrics).Count)
Add-TimelineEvent -Timeline $timeline -Stage 'RootCause' -Signal 'BrokenMeasureRootCauseGraph' -Detail ('Root cause candidates {0}.' -f $rootCauseGraph.rootCauseCount)
if ($flightRecorder.latest) {
    Add-TimelineEvent -Timeline $timeline -Stage 'History' -Signal 'FlightRecorder' -Detail ('Latest recorded score {0}, decision {1}, trend {2}.' -f $flightRecorder.latest.overallTrustScore, $flightRecorder.latest.releaseDecision, $flightRecorder.trend)
}
elseif ($flightRecorder.error) {
    Add-TimelineEvent -Timeline $timeline -Stage 'History' -Signal 'FlightRecorderUnavailable' -Detail $flightRecorder.error
}
if ($comparison) {
    Add-TimelineEvent -Timeline $timeline -Stage 'Behavior' -Signal 'MeasureBehaviorComparison' -Detail ('Status {0}; comparisons {1}; failed {2}; not available {3}.' -f $comparison.status, $comparison.comparisonCount, $comparison.failedCount, $comparison.notAvailableCount)
}

$affectedMeasures = foreach ($metric in @($selectedMetrics)) {
    $trustItem = @($trust.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    $rootCauses = @($rootCauseGraph.rootCauses | Where-Object { $_.measure -eq $metric.name })
    $comparisons = @($comparison.comparisons | Where-Object { $_.measure -eq $metric.name -or $_.id -match [regex]::Escape($metric.id) })
    [pscustomobject]@{
        name = $metric.name
        table = $metric.table
        source = $metric.source
        trustScore = if ($trustItem) { $trustItem.trustScore } else { $null }
        risks = @($metric.risks)
        rootCauseCount = $rootCauses.Count
        comparisonStatuses = @($comparisons | ForEach-Object { $_.status } | Sort-Object -Unique)
    }
}

$probableRootCauses = foreach ($measure in @($affectedMeasures)) {
    $graphItems = @($rootCauseGraph.rootCauses | Where-Object { $_.measure -eq $measure.name })
    if ($graphItems.Count -gt 0) {
        foreach ($item in $graphItems) {
            [pscustomobject]@{
                measure = $measure.name
                cause = $item.rootCause
                confidence = if (@($item.risks).Count -gt 0) { 'High' } else { 'Medium' }
                evidence = @(@($item.risks) + @($measure.comparisonStatuses | ForEach-Object { "comparisonStatus:$_" }))
                fixOrder = $item.fixOrder
            }
        }
    }
    else {
        [pscustomobject]@{
            measure = $measure.name
            cause = if (@($measure.risks).Count -gt 0) { 'DAX risk requires manual review.' } elseif ($measure.trustScore -lt 80) { 'Trust score deductions require owner and validation review.' } else { 'No deterministic root cause found from offline signals.' }
            confidence = if (@($measure.risks).Count -gt 0 -or $measure.trustScore -lt 80) { 'Medium' } else { 'Low' }
            evidence = @(@($measure.risks) + @("trustScore:$($measure.trustScore)"))
            fixOrder = 'Review locally before downstream validation.'
        }
    }
}

$rollbackGuidance = @(
    'Do not mutate PBIX/PBIT binaries from this report.',
    'If behavior validation fails, restore the previous DAX expression from source control or the before PBIP/TMDL model.',
    'Rerun MetricCatalog, KPI Trust Score, BrokenMeasureRootCauseGraph, and measure behavior comparison before release sign-off.'
)
if ($comparison -and $comparison.status -eq 'Failed') {
    $rollbackGuidance += 'Failed comparison rows should be treated as rollback candidates unless business owners approve the variance.'
}

$validationPlan = @(
    'Run New-PowerBIMetricCatalog.ps1 to confirm affected measures are still discoverable.',
    'Run New-PowerBIKpiTrustScore.ps1 and confirm affected measure trust scores are 80 or higher, or document an explicit waiver.',
    'Run New-PowerBIBrokenMeasureRootCauseGraph.ps1 to verify no high-confidence root cause remains open.',
    'Run Compare-PowerBIMeasureBehavior.ps1 with before/after paths or baseline/current result files for value-level validation.'
)

$incidentIdSource = '{0}|{1}|{2}' -f $root, ($MeasureName -as [string]), (Get-Date).ToString('yyyyMMddHHmmss')
$incidentHash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($incidentIdSource))).Replace('-', '').Substring(0, 12).ToLowerInvariant()
$result = [pscustomobject]@{
    schema = 'codex.powerbi.kpiIncidentReport.v1'
    incidentId = "pbi-kpi-$incidentHash"
    root = $root
    generated = (Get-Date).ToString('s')
    measureName = $MeasureName
    comparisonStatus = if ($comparison) { $comparison.status } else { 'NotRequested' }
    affectedMeasures = @($affectedMeasures)
    evidenceTimeline = @($timeline.ToArray())
    probableRootCauses = @($probableRootCauses)
    rollbackGuidance = @($rollbackGuidance)
    validationPlan = @($validationPlan)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 12
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI KPI Incident Report')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $result.schema))
$lines.Add(('Incident ID: `{0}`' -f $result.incidentId))
$lines.Add(('Root: `{0}`' -f $result.root))
$lines.Add(('Generated: {0}' -f $result.generated))
$lines.Add(('Comparison status: {0}' -f $result.comparisonStatus))
$lines.Add('')
$lines.Add('## Affected Measures')
$lines.Add('')
foreach ($measure in $result.affectedMeasures) {
    $lines.Add(('- `{0}` trust={1}; risks={2}; root causes={3}' -f $measure.name, $measure.trustScore, ((@($measure.risks) -join '; ')), $measure.rootCauseCount))
}
$lines.Add('')
$lines.Add('## Evidence Timeline')
$lines.Add('')
foreach ($event in $result.evidenceTimeline) {
    $lines.Add(('- [{0}] {1}: {2}' -f $event.stage, $event.signal, $event.detail))
}
$lines.Add('')
$lines.Add('## Probable Root Causes')
$lines.Add('')
foreach ($cause in $result.probableRootCauses) {
    $lines.Add(('- `{0}`: {1} ({2}) - {3}' -f $cause.measure, $cause.cause, $cause.confidence, $cause.fixOrder))
}
$lines.Add('')
$lines.Add('## Rollback Guidance')
$lines.Add('')
foreach ($item in $result.rollbackGuidance) { $lines.Add(('- {0}' -f $item)) }
$lines.Add('')
$lines.Add('## Validation Plan')
$lines.Add('')
foreach ($item in $result.validationPlan) { $lines.Add(('- {0}' -f $item)) }
$lines.Add('')
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
