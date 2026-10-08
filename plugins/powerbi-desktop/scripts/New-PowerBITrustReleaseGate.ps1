param(
    [string]$Path = ".",
    [string]$OutputPath,
    [string]$SemanticExpectationsPath,
    [switch]$CheckLiveAvailability,
    [switch]$TreatPendingSemanticTestsAsNoGo,
    [switch]$TreatLiveUnavailableAsNoGo,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$scorecard = & (Join-Path $scriptRoot 'New-PowerBIModelGovernanceScorecard.ps1') -Path $Path -Json | ConvertFrom-Json
$copilot = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $Path -Json | ConvertFrom-Json
$fixes = & (Join-Path $scriptRoot 'New-PowerBIGuidedFixPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $Path -ExpectationsPath $SemanticExpectationsPath -Json | ConvertFrom-Json
$p0 = @($fixes.fixes | Where-Object priority -eq 'P0').Count
$p1 = @($fixes.fixes | Where-Object priority -eq 'P1').Count
$lowTrust = @($trust.metrics | Where-Object { $_.trustScore -lt 60 }).Count
$pendingSemantic = @($semantic.tests | Where-Object { $_.result -in @('PendingLiveDax', 'NotRun') -or $_.status -eq 'Generated' }).Count
$liveStatus = 'NotChecked'
$liveDetail = 'Live validation was not requested.'
if ($CheckLiveAvailability) {
    try {
        $connection = & (Join-Path $scriptRoot 'Get-PowerBIDesktopLiveConnection.ps1') -Json | ConvertFrom-Json
        if ($connection.powerBIDesktopRunning -and $connection.connectionString) {
            $liveStatus = 'Available'
            $liveDetail = $connection.connectionString
        }
        else {
            $liveStatus = 'Unavailable'
            $liveDetail = 'Power BI Desktop live endpoint was not detected.'
        }
    }
    catch {
        $liveStatus = 'Unavailable'
        $liveDetail = $_.Exception.Message
    }
}

function New-GateCheck {
    param([string]$Id, [string]$Name, [string]$Status, [object]$Value, [string]$Detail, [string]$GateImpact)
    [pscustomobject]@{
        id = $Id
        name = $Name
        status = $Status
        value = $Value
        detail = $Detail
        gateImpact = $GateImpact
    }
}

$pendingSemanticStatus = if ($pendingSemantic -eq 0) { 'Pass' } elseif ($TreatPendingSemanticTestsAsNoGo) { 'Fail' } else { 'Warn' }
$liveGateStatus = if ($liveStatus -eq 'Available') { 'Pass' } elseif ($liveStatus -eq 'NotChecked') { 'Warn' } elseif ($TreatLiveUnavailableAsNoGo) { 'Fail' } else { 'Warn' }
$checks = @(
    (New-GateCheck -Id 'kpi.trustScore' -Name 'KPI trust score' -Status $(if ($trust.overallTrustScore -ge 80) { 'Pass' } elseif ($trust.overallTrustScore -ge 60) { 'Warn' } else { 'Fail' }) -Value $trust.overallTrustScore -Detail 'Overall KPI trust score.' -GateImpact 'No-Go when below warn threshold')
    (New-GateCheck -Id 'kpi.lowTrustCount' -Name 'Low-trust KPI count' -Status $(if ($lowTrust -eq 0) { 'Pass' } else { 'Fail' }) -Value $lowTrust -Detail 'KPIs below trust score 60.' -GateImpact 'No-Go')
    (New-GateCheck -Id 'fixes.openP0' -Name 'Open P0 guided fixes' -Status $(if ($p0 -eq 0) { 'Pass' } else { 'Fail' }) -Value $p0 -Detail 'Open P0 fixes block release.' -GateImpact 'No-Go')
    (New-GateCheck -Id 'fixes.openP1' -Name 'Open P1 guided fixes' -Status $(if ($p1 -eq 0) { 'Pass' } else { 'Warn' }) -Value $p1 -Detail 'Open P1 fixes require explicit caveat or waiver.' -GateImpact 'Warn')
    (New-GateCheck -Id 'governance.score' -Name 'Governance score' -Status $(if ($scorecard.overallScore -ge 70) { 'Pass' } else { 'Warn' }) -Value $scorecard.overallScore -Detail 'Model governance scorecard result.' -GateImpact 'Warn')
    (New-GateCheck -Id 'copilot.readiness' -Name 'Copilot readiness' -Status $(if ($copilot.score -ge 70) { 'Pass' } else { 'Warn' }) -Value $copilot.score -Detail 'Copilot readiness score.' -GateImpact 'Warn')
    (New-GateCheck -Id 'semantic.pendingTests' -Name 'Pending semantic tests' -Status $pendingSemanticStatus -Value $pendingSemantic -Detail 'Generated, not-run, or live-DAX-pending semantic tests.' -GateImpact $(if ($TreatPendingSemanticTestsAsNoGo) { 'No-Go' } else { 'Warn' }))
    (New-GateCheck -Id 'live.availability' -Name 'Live validation availability' -Status $liveGateStatus -Value $liveStatus -Detail $liveDetail -GateImpact $(if ($TreatLiveUnavailableAsNoGo) { 'No-Go' } else { 'Warn' }))
)
$failCount = @($checks | Where-Object status -eq 'Fail').Count
$warnCount = @($checks | Where-Object status -eq 'Warn').Count
$blockingReasons = @($checks | Where-Object status -eq 'Fail' | ForEach-Object { '{0}: {1}' -f $_.id, $_.value })
$warnings = @($checks | Where-Object status -eq 'Warn' | ForEach-Object { '{0}: {1}' -f $_.id, $_.value })
$decision = if ($failCount -gt 0) { 'No-Go' } elseif ($warnCount -gt 0) { 'Warn' } else { 'Go' }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.trustReleaseGate.v2'
    root = $trust.root
    generated = (Get-Date).ToString('s')
    decision = $decision
    machineReadable = $true
    failCount = $failCount
    warnCount = $warnCount
    checkCount = $checks.Count
    openP0Count = $p0
    openP1Count = $p1
    pendingSemanticTestCount = $pendingSemantic
    liveStatus = $liveStatus
    checks = $checks
    blockingReasons = @($blockingReasons)
    warnings = @($warnings)
    releaseNote = $(if ($decision -eq 'Go') { 'Publish candidate after normal business sign-off.' } elseif ($decision -eq 'Warn') { 'Publish only with documented caveats.' } else { 'Block publish until failing checks are remediated.' })
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Trust Release Gate', '', "Decision: **$decision**", '', "Release note: $($result.releaseNote)", '', '## Checks') + @($checks | ForEach-Object { "- [$($_.status)] $($_.name): $($_.value) - $($_.detail)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
