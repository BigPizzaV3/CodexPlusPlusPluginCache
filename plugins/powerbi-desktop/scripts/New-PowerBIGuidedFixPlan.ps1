param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scan = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$impact = & (Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json | ConvertFrom-Json
$visualIntent = & (Join-Path $scriptRoot 'New-PowerBIVisualIntentAnalyzer.ps1') -Path $Path -Json | ConvertFrom-Json

$fixes = New-Object System.Collections.Generic.List[object]
foreach ($finding in @($scan.findings)) {
    $priority = if ($finding.severity -eq 'High') { 'P0' } elseif ($finding.severity -eq 'Medium') { 'P1' } else { 'P2' }
    $problemText = if ($finding.message) { $finding.message } elseif ($finding.detail) { $finding.detail } else { $finding.title }
    $fixes.Add([pscustomobject]@{
        priority = $priority
        theme = $finding.category
        source = $finding.source
        problem = $problemText
        guidedStep = 'Inspect the cited file or measure, prepare a reviewed change plan, then rerun scan and measure tests.'
        nextScript = 'Invoke-PowerBIInsightScan.ps1'
        validation = 'Run Invoke-PowerBIInsightScan.ps1 and New-PowerBIMeasureTestPlan.ps1 for the affected model.'
        releaseGate = if ($priority -eq 'P0') { 'Blocks release until closed or explicitly waived.' } else { 'Document before release if not closed.' }
        requiresApplyConfirmation = $true
        status = 'Open'
    })
}
foreach ($metric in @($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 })) {
    $impactItem = @($impact.measures | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    $priority = if ($impactItem.downstreamCount -gt 0 -or $metric.riskLevel -eq 'high') { 'P0' } else { 'P1' }
    $fixes.Add([pscustomobject]@{
        priority = $priority
        theme = 'DAX Refactoring'
        source = $metric.name
        problem = (@($metric.risks) -join '; ')
        guidedStep = 'Draft a narrower or deterministic measure rewrite, preserving accepted business totals. Do not apply until reviewed.'
        nextScript = 'New-PowerBIDaxFixSimulation.ps1'
        validation = ('Run generated tests for `{0}` and validate downstream count {1}.' -f $metric.name, $impactItem.downstreamCount)
        releaseGate = if ($priority -eq 'P0') { 'Blocks release until downstream measures and business totals are validated.' } else { 'Requires validation evidence before release.' }
        requiresApplyConfirmation = $true
        status = 'Open'
    })
}
foreach ($finding in @($visualIntent.findings | Where-Object { $_.severity -in @('High', 'Medium', 'NeedsInput') })) {
    $priority = if ($finding.severity -eq 'High') { 'P0' } elseif ($finding.severity -eq 'Medium') { 'P1' } else { 'P2' }
    $fixes.Add([pscustomobject]@{
        priority = $priority
        theme = $finding.category
        source = $finding.source
        problem = $finding.title
        guidedStep = $finding.detail
        nextScript = 'New-PowerBIVisualIntentAnalyzer.ps1'
        validation = 'Rerun visual intent analysis and screenshot UX review when report screenshots are available.'
        releaseGate = 'Review unresolved report/visual findings before release candidate sign-off.'
        requiresApplyConfirmation = $true
        status = 'Open'
    })
}

$ordered = @($fixes.ToArray() | Sort-Object @{ Expression = { @{ P0 = 0; P1 = 1; P2 = 2 }[$_.priority] } }, Source)
$result = [pscustomobject]@{
    schema = 'codex.powerbi.guidedFixPlan.v1'
    root = $scan.root
    generated = (Get-Date).ToString('s')
    mode = 'PlanOnly'
    mutatingFixesApplied = $false
    fixCount = $ordered.Count
    releaseGates = @(
        [pscustomobject]@{ name = 'P0 fixes'; status = $(if (@($ordered | Where-Object priority -eq 'P0').Count -eq 0) { 'Pass' } else { 'Fail' }); detail = 'No open P0 fixes before publish.' },
        [pscustomobject]@{ name = 'Visual intent review'; status = $(if ($visualIntent.reportMetadataStatus -eq 'Available') { 'Pass' } else { 'Warn' }); detail = 'Report metadata should be available for visual intelligence.' },
        [pscustomobject]@{ name = 'Apply confirmation'; status = 'Pass'; detail = 'This plan does not mutate files. Apply-capable scripts require explicit -Apply or equivalent confirmation.' }
    )
    fixes = $ordered
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Guided Fix Plan')
$md.Add('')
$md.Add(('Fixes: {0}' -f $result.fixCount))
$md.Add('')
foreach ($fix in $result.fixes) {
    $md.Add(('## [{0}] {1}' -f $fix.priority, $fix.source))
    $md.Add(('- Theme: {0}' -f $fix.theme))
    $md.Add(('- Problem: {0}' -f $fix.problem))
    $md.Add(('- Guided step: {0}' -f $fix.guidedStep))
    $md.Add(('- Next script: {0}' -f $fix.nextScript))
    $md.Add(('- Validation: {0}' -f $fix.validation))
    $md.Add(('- Release gate: {0}' -f $fix.releaseGate))
    $md.Add(('- Status: {0}' -f $fix.status))
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
