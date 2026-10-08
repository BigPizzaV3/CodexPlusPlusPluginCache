param(
    [string]$ImagePath,
    [string]$ReportName = '[TODO: report]',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

function New-Finding {
    param([string]$Severity, [string]$Title, [string]$Detail, [string]$Evidence = $null)
    [pscustomobject]@{
        severity = $Severity
        title = $Title
        detail = $Detail
        evidence = $Evidence
    }
}

$checks = @(
    [pscustomobject]@{ area = 'Readability'; recommendation = 'Verify title hierarchy, data labels, axis density, and contrast at 100 percent zoom.' },
    [pscustomobject]@{ area = 'Executive Fit'; recommendation = 'Ensure first viewport shows decision KPI, trend, variance, and owner context.' },
    [pscustomobject]@{ area = 'Accessibility'; recommendation = 'Check color-only encoding, text contrast, and keyboard/screen-reader metadata.' },
    [pscustomobject]@{ area = 'Narrative'; recommendation = 'Confirm visuals answer one business question instead of exposing raw model structure.' }
)

$exists = $ImagePath -and (Test-Path -LiteralPath $ImagePath)
$resolvedImage = if ($exists) { (Resolve-Path -LiteralPath $ImagePath).Path } else { $ImagePath }
$findings = if ($exists) {
    @(
        New-Finding -Severity 'Info' -Title 'Screenshot ready for visual review' -Detail 'A screenshot path was supplied. Use vision review to inspect layout, contrast, density, titles, and visual affordances.' -Evidence $resolvedImage
    )
}
else {
    @(
        New-Finding -Severity 'NeedsInput' -Title 'Screenshot not available' -Detail 'Provide a rendered report screenshot to enable concrete visual UX inspection. Metadata-only report intelligence can still run separately.' -Evidence $ImagePath
    )
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.screenshotUxReview.v1'
    generated = (Get-Date).ToString('s')
    reportName = $ReportName
    imagePath = $resolvedImage
    status = if ($exists) { 'NeedsVisionReview' } else { 'NotAvailable' }
    needsInput = -not $exists
    reviewMode = if ($exists) { 'ScreenshotEnvelope' } else { 'MetadataOnlyFallback' }
    checks = $checks
    findingCount = @($findings).Count
    findings = @($findings)
    nextActions = if ($exists) {
        @('Run a vision-capable review over the screenshot.', 'Compare visible visuals against report metadata and critical measures.', 'Capture follow-up screenshots after changes.')
    }
    else {
        @('Export or capture a report page screenshot.', 'Run New-PowerBIVisualIntentAnalyzer.ps1 for metadata-only findings.', 'Attach screenshot path and rerun this review.')
    }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @('# Report Screenshot UX Review', '', "Status: $($result.status)", "Needs input: $($result.needsInput)", '', '## Checks') + @($checks | ForEach-Object { "- $($_.area): $($_.recommendation)" })
$lines += @('', '## Findings') + @($result.findings | ForEach-Object { "- [$($_.severity)] $($_.title): $($_.detail)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
