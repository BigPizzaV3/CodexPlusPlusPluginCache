param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json,
    [int]$MaxItems = 10
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Path).Path

$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $source -Json | ConvertFrom-Json
$fixes = & (Join-Path $scriptRoot 'New-PowerBIGuidedFixPlan.ps1') -Path $source -Json | ConvertFrom-Json
$simulations = & (Join-Path $scriptRoot 'New-PowerBIDaxFixSimulation.ps1') -Path $source -Json | ConvertFrom-Json
$lineage = & (Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $source -Json | ConvertFrom-Json
$usageTrust = & (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $source -Json | ConvertFrom-Json
$service = & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $source -Json | ConvertFrom-Json

function Get-SeverityWeight {
    param([string]$Severity)
    switch -Regex ($Severity) {
        'P0|Critical|High|Fail|No-Go' { 100; break }
        'P1|Medium|Warn|Review' { 70; break }
        default { 35 }
    }
}

$candidates = New-Object System.Collections.Generic.List[object]
foreach ($check in @($gate.checks | Where-Object { $_.status -ne 'Pass' })) {
    $candidates.Add([pscustomobject]@{
        theme = 'Release Gate'
        severity = $check.status
        measure = $null
        businessImpact = $check.gateImpact
        technicalEvidence = ('{0}: {1}' -f $check.name, $check.detail)
        proposedFix = 'Resolve this release-gate check before publishing.'
        validation = 'Rerun New-PowerBITrustReleaseGate.ps1.'
        ownerHint = 'BI release owner'
        releaseImpact = $check.gateImpact
        score = (Get-SeverityWeight $check.status) + 20
    })
}
foreach ($fix in @($fixes.fixes)) {
    $impact = @($lineage.measures | Where-Object { $_.name -eq $fix.measure } | Select-Object -First 1)
    $simulation = @($simulations.simulations | Where-Object { $_.measure -eq $fix.measure } | Select-Object -First 1)
    $usage = @($usageTrust.priorities | Where-Object { $_.metric -eq $fix.measure } | Select-Object -First 1)
    $impactScore = if ($impact) { [int]$impact.impactScore } else { 0 }
    $usageBoost = if ($usage) { 25 } else { 0 }
    $validation = if ($simulation -and @($simulation.validationQueries).Count -gt 0) { @($simulation.validationQueries) -join '; ' } else { 'Rerun guided fix, semantic tests, and release gate.' }
    $candidates.Add([pscustomobject]@{
        theme = 'Semantic Remediation'
        severity = if ($impactScore -ge 60) { 'High' } elseif ($impactScore -ge 30) { 'Medium' } else { 'Low' }
        measure = $fix.measure
        businessImpact = if ($usage) { 'High-usage or low-trust KPI remediation.' } else { 'Model quality and release trust improvement.' }
        technicalEvidence = $fix.finding
        proposedFix = if ($simulation) { $simulation.simulatedDax } else { $fix.recommendedAction }
        validation = $validation
        ownerHint = 'Metric owner'
        releaseImpact = if ($impactScore -ge 60 -or $usage) { 'Blocks or strongly affects release confidence.' } else { 'Improves release quality.' }
        score = (Get-SeverityWeight $(if ($impactScore -ge 60) { 'High' } else { 'Medium' })) + $impactScore + $usageBoost + $(if ($simulation) { 10 } else { 0 })
    })
}
foreach ($finding in @($service.findings)) {
    $candidates.Add([pscustomobject]@{
        theme = 'Service Governance'
        severity = $finding.severity
        measure = $null
        businessImpact = 'Service governance and tenant release evidence.'
        technicalEvidence = ('{0}: {1}' -f $finding.title, $finding.detail)
        proposedFix = 'Validate ownership, endorsement, labels, refresh, and source-control status in the service.'
        validation = 'Rerun New-PowerBIServiceScanner.ps1 and attach tenant evidence.'
        ownerHint = 'Power BI service owner'
        releaseImpact = if ($finding.severity -in @('Critical','High')) { 'Release blocker candidate.' } else { 'Release evidence gap.' }
        score = (Get-SeverityWeight $finding.severity) + 10
    })
}

$ranked = @($candidates | Sort-Object @{ Expression = { $_.score }; Descending = $true }, theme | Select-Object -First $MaxItems)
$items = for ($i = 0; $i -lt $ranked.Count; $i++) {
    $item = $ranked[$i]
    [pscustomobject]@{
        rank = $i + 1
        theme = $item.theme
        severity = $item.severity
        measure = $item.measure
        businessImpact = $item.businessImpact
        technicalEvidence = $item.technicalEvidence
        proposedFix = $item.proposedFix
        validation = $item.validation
        ownerHint = $item.ownerHint
        releaseImpact = $item.releaseImpact
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.agenticRemediationPlan.v1'
    generated = (Get-Date).ToString('s')
    source = $source
    itemCount = @($items).Count
    items = @($items)
    releaseDecision = $gate.decision
    recommendedNextAction = if (@($items).Count -gt 0) { ('Start with rank 1: {0}' -f $items[0].theme) } else { 'No remediation items found. Keep release evidence current.' }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @('# Power BI Agentic Remediation Plan', '', "Release decision: **$($result.releaseDecision)**", "Items: $($result.itemCount)", '') + @($result.items | ForEach-Object { "## $($_.rank). $($_.theme)`n- Severity: $($_.severity)`n- Measure: $($_.measure)`n- Business impact: $($_.businessImpact)`n- Evidence: $($_.technicalEvidence)`n- Proposed fix: $($_.proposedFix)`n- Validation: $($_.validation)`n- Owner: $($_.ownerHint)`n" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
