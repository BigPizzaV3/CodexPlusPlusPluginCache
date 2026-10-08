param(
    [string]$Path = ".",
    [string]$ReviewDirectory,
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

function Add-Finding {
    param(
        [System.Collections.Generic.List[object]]$Findings,
        [string]$Category,
        [string]$Severity,
        [string]$Message,
        [string]$Evidence,
        [string]$Recommendation
    )
    $Findings.Add([pscustomobject]@{
        category = $Category
        severity = $Severity
        message = $Message
        evidence = $Evidence
        recommendation = $Recommendation
    })
}

function Read-JsonIfExists {
    param([string]$FilePath)
    if ($FilePath -and (Test-Path -LiteralPath $FilePath)) {
        return (Get-Content -Raw -LiteralPath $FilePath | ConvertFrom-Json)
    }
    return $null
}

$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $root -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $root -Json | ConvertFrom-Json
$insight = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $root -Json | ConvertFrom-Json
$pbip = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $root -Json | ConvertFrom-Json

$reviewRoot = $null
if ($ReviewDirectory -and (Test-Path -LiteralPath $ReviewDirectory)) {
    $reviewRoot = (Resolve-Path -LiteralPath $ReviewDirectory).Path
}

$releaseGate = if ($reviewRoot) { Read-JsonIfExists (Join-Path $reviewRoot 'trust-release-gate.json') } else { $null }
$serviceScanner = if ($reviewRoot) { Read-JsonIfExists (Join-Path $reviewRoot 'service-scanner.json') } else { $null }

$findings = New-Object System.Collections.Generic.List[object]

if ($catalog.metricCount -eq 0) {
    Add-Finding $findings 'question_fit' 'High' 'No measures were found in text-based Power BI artifacts.' 'Metric catalog returned zero metrics.' 'Export PBIP/TMDL/DAX metadata before treating analysis outputs as release-ready.'
}

$missingOwner = @($catalog.metrics | Where-Object { $_.owner -match 'TODO' })
$missingDefinition = @($catalog.metrics | Where-Object { $_.businessDefinition -match 'TODO' })
if ($missingOwner.Count -gt 0) {
    Add-Finding $findings 'metric_definitions' 'Medium' 'Metric ownership is incomplete.' ("Missing owner count: $($missingOwner.Count)") 'Assign business or BI owners for release-facing KPIs.'
}
if ($missingDefinition.Count -gt 0) {
    Add-Finding $findings 'metric_definitions' 'Medium' 'Business definitions are incomplete.' ("Missing definition count: $($missingDefinition.Count)") 'Document business meaning, grain, accepted filters, and denominator for each release-facing KPI.'
}

$riskyMetrics = @($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 })
if ($riskyMetrics.Count -gt 0) {
    Add-Finding $findings 'calculation_support' 'Medium' 'Some DAX measures carry review risks.' ("Risky metric count: $($riskyMetrics.Count)") 'Spot-check high-impact DAX and validate affected measures before stakeholder release.'
}

$pending = @($semantic.tests | Where-Object { $_.result -in @('PendingLiveDax', 'NotRun', 'QueryGenerated') -or $_.status -eq 'Generated' })
if ($pending.Count -gt 0) {
    Add-Finding $findings 'calculation_support' 'Medium' 'Semantic tests are generated or pending rather than validated against evidence.' ("Pending/generated semantic tests: $($pending.Count)") 'Provide measure expectations or live DAX evidence and rerun semantic tests with pending checks treated as release risk.'
}
if ($semantic.failedCount -gt 0) {
    Add-Finding $findings 'calculation_support' 'High' 'Semantic tests failed.' ("Failed semantic tests: $($semantic.failedCount)") 'Resolve failed semantic expectations before sharing release findings.'
}

if ($pbip.roundtripStatus -ne 'Ready') {
    Add-Finding $findings 'reproducibility' 'Medium' 'PBIP roundtrip readiness is incomplete.' ("Roundtrip status: $($pbip.roundtripStatus)") 'Use PBIP/TMDL source structure or document manual Desktop validation before release.'
}

if (Test-HasProperty $insight 'findingCount' -and $insight.findingCount -gt 0) {
    Add-Finding $findings 'data_quality' 'Medium' 'Insight scan found model or source-control risks.' ("Finding count: $($insight.findingCount)") 'Review insight-scan findings and label unresolved risks as caveats in stakeholder-facing reports.'
}

if ($releaseGate -and (Test-HasProperty $releaseGate 'decision') -and $releaseGate.decision -eq 'No-Go') {
    Add-Finding $findings 'stakeholder_readiness' 'High' 'Release gate is No-Go.' ("Gate warnings: $($releaseGate.warnCount); failures: $($releaseGate.failCount)") 'Do not share as release-ready until blocking gate checks are cleared or formally waived.'
}

if ($serviceScanner -and (Test-HasProperty $serviceScanner 'findingCount') -and $serviceScanner.findingCount -gt 0) {
    Add-Finding $findings 'data_freshness' 'Medium' 'Service scanner found governance or service-readiness caveats.' ("Service findings: $($serviceScanner.findingCount)") 'Confirm ownership, refresh, endorsement, and service-readiness caveats before publication.'
}

$highCount = @($findings | Where-Object severity -eq 'High').Count
$mediumCount = @($findings | Where-Object severity -eq 'Medium').Count
$findingCount = $findings.Count
$findingArray = @($findings.ToArray())
$assessment = if ($highCount -gt 0) { 'NeedsRevision' } elseif ($mediumCount -gt 0) { 'ShareWithCaveats' } else { 'ReadyToShare' }
$insightFindingCount = if (Test-HasProperty $insight 'findingCount') { $insight.findingCount } else { $null }
$releaseDecision = if ($releaseGate) { $releaseGate.decision } else { 'NotProvided' }

$checks = New-Object psobject
$checks | Add-Member -NotePropertyName metricCount -NotePropertyValue $catalog.metricCount
$checks | Add-Member -NotePropertyName missingOwnerCount -NotePropertyValue $missingOwner.Count
$checks | Add-Member -NotePropertyName missingBusinessDefinitionCount -NotePropertyValue $missingDefinition.Count
$checks | Add-Member -NotePropertyName riskyMetricCount -NotePropertyValue $riskyMetrics.Count
$checks | Add-Member -NotePropertyName semanticTestCount -NotePropertyValue $semantic.testCount
$checks | Add-Member -NotePropertyName semanticFailedCount -NotePropertyValue $semantic.failedCount
$checks | Add-Member -NotePropertyName pendingSemanticTestCount -NotePropertyValue $pending.Count
$checks | Add-Member -NotePropertyName pbipRoundtripStatus -NotePropertyValue $pbip.roundtripStatus
$checks | Add-Member -NotePropertyName insightFindingCount -NotePropertyValue $insightFindingCount
$checks | Add-Member -NotePropertyName releaseDecision -NotePropertyValue $releaseDecision

$result = New-Object psobject
$result | Add-Member -NotePropertyName schema -NotePropertyValue 'codex.powerbi.analysisMethodologyValidation.v1'
$result | Add-Member -NotePropertyName generated -NotePropertyValue (Get-Date).ToString('s')
$result | Add-Member -NotePropertyName source -NotePropertyValue $root
$result | Add-Member -NotePropertyName reviewDirectory -NotePropertyValue $reviewRoot
$result | Add-Member -NotePropertyName assessment -NotePropertyValue $assessment
$result | Add-Member -NotePropertyName highCount -NotePropertyValue $highCount
$result | Add-Member -NotePropertyName mediumCount -NotePropertyValue $mediumCount
$result | Add-Member -NotePropertyName findingCount -NotePropertyValue $findingCount
$result | Add-Member -NotePropertyName checks -NotePropertyValue $checks
$result | Add-Member -NotePropertyName findings -NotePropertyValue $findingArray

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Power BI Analysis Methodology Validation',
    '',
    "Assessment: **$($result.assessment)**",
    ('Source: `{0}`' -f $result.source),
    '',
    '## Methodology Review',
    '',
    "- Metrics found: $($result.checks.metricCount)",
    "- Missing owners: $($result.checks.missingOwnerCount)",
    "- Missing business definitions: $($result.checks.missingBusinessDefinitionCount)",
    "- Pending/generated semantic tests: $($result.checks.pendingSemanticTestCount)",
    "- PBIP roundtrip status: $($result.checks.pbipRoundtripStatus)",
    '',
    '## Issues Found'
)
if ($findings.Count -eq 0) {
    $lines += '- No methodology blockers or material caveats found.'
}
else {
    $lines += @($findings | ForEach-Object { "- [$($_.severity)] $($_.category): $($_.message) Evidence: $($_.evidence) Recommendation: $($_.recommendation)" })
}
$stakeholderCaveat = if ($assessment -eq 'ReadyToShare') { '- None beyond normal source freshness and owner sign-off.' } else { '- Communicate all High and Medium findings above before stakeholders act on the analysis.' }
$lines += @(
    '',
    '## Required Caveats For Stakeholders',
    $stakeholderCaveat
)
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
