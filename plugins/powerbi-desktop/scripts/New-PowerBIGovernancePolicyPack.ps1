param(
    [ValidateSet('EnterpriseBI','Finance','Healthcare','ExecutiveReporting','SelfServiceBI','FabricPremium')]
    [string]$Profile = 'EnterpriseBI',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$baseRules = @(
    @{ id = 'metric-owner'; severity = 'High'; category = 'Ownership'; gateImpact = 'Warn'; rule = 'Every certified KPI must have owner and business definition.' },
    @{ id = 'pbip-source'; severity = 'High'; category = 'Source Control'; gateImpact = 'No-Go'; rule = 'Production reports must have PBIP/TMDL source-control representation.' },
    @{ id = 'refresh-owner'; severity = 'Medium'; category = 'Operations'; gateImpact = 'Warn'; rule = 'Refresh schedule, gateway, and credential owner must be documented.' },
    @{ id = 'dax-determinism'; severity = 'Medium'; category = 'Semantic Quality'; gateImpact = 'Warn'; rule = 'Avoid volatile DAX in governed release KPIs unless documented.' },
    @{ id = 'sensitivity-label'; severity = 'Medium'; category = 'Compliance'; gateImpact = 'Warn'; rule = 'Service items require a reviewed sensitivity label.' },
    @{ id = 'release-gate'; severity = 'High'; category = 'Release'; gateImpact = 'No-Go'; rule = 'No production deployment when trust release gate is No-Go.' },
    @{ id = 'open-p0-fixes'; severity = 'Critical'; category = 'Release'; gateImpact = 'No-Go'; rule = 'Open P0 guided fixes block release.' },
    @{ id = 'open-p1-fixes'; severity = 'High'; category = 'Release'; gateImpact = 'Warn'; rule = 'Open P1 guided fixes require an explicit release caveat or waiver.' },
    @{ id = 'semantic-tests-pending'; severity = 'High'; category = 'Validation'; gateImpact = 'Warn'; rule = 'Pending semantic tests must be resolved or accepted as release risk.' },
    @{ id = 'live-validation-unavailable'; severity = 'High'; category = 'Validation'; gateImpact = 'Warn'; rule = 'Unavailable live validation must be visible in release evidence and can be configured as No-Go.' }
)

$profileRules = switch ($Profile) {
    'Finance' { @(@{ id = 'finance-reconciliation'; severity = 'High'; category = 'Finance Controls'; gateImpact = 'No-Go'; rule = 'Finance KPIs require reconciliation source and period-close owner.' }) }
    'Healthcare' { @(@{ id = 'phi-minimization'; severity = 'High'; category = 'Privacy'; gateImpact = 'No-Go'; rule = 'Healthcare reports must minimize patient-identifiable columns and document access scope.' }) }
    'ExecutiveReporting' { @(@{ id = 'executive-first-view'; severity = 'Medium'; category = 'Report UX'; gateImpact = 'Warn'; rule = 'First viewport must expose KPI, variance, trend, and business action.' }) }
    'SelfServiceBI' { @(@{ id = 'self-service-certified-dataset'; severity = 'Medium'; category = 'Reuse'; gateImpact = 'Warn'; rule = 'Self-service reports should reuse certified semantic models where possible.' }) }
    'FabricPremium' { @(@{ id = 'capacity-aware'; severity = 'High'; category = 'Capacity'; gateImpact = 'No-Go'; rule = 'Fabric Premium rollout requires capacity, deployment pipeline, and refresh concurrency review.' }) }
    default { @(@{ id = 'enterprise-endorsement'; severity = 'Medium'; category = 'Audience'; gateImpact = 'Warn'; rule = 'Enterprise reports need endorsement and audience review.' }) }
}

$rules = @($baseRules + $profileRules | ForEach-Object { [pscustomobject]$_ })
$gatePolicy = [pscustomobject]@{
    schema = 'codex.powerbi.governanceGatePolicy.v1'
    blockOnOpenP0 = $true
    warnOnOpenP1 = $true
    warnOnPendingSemanticTests = $true
    blockOnPendingSemanticTests = $false
    warnOnLiveUnavailable = $true
    blockOnLiveUnavailable = $false
    machineReadableResultsRequired = $true
}
$result = [pscustomobject]@{
    schema = 'codex.powerbi.governancePolicyPack.v1'
    generated = (Get-Date).ToString('s')
    profile = $Profile
    ruleCount = $rules.Count
    gatePolicy = $gatePolicy
    rules = $rules
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @(
    '# Governance Policy Pack',
    '',
    "Profile: $Profile",
    '',
    '## Gate policy',
    '',
    ('- Block on open P0: {0}' -f $gatePolicy.blockOnOpenP0),
    ('- Warn on open P1: {0}' -f $gatePolicy.warnOnOpenP1),
    ('- Warn on pending semantic tests: {0}' -f $gatePolicy.warnOnPendingSemanticTests),
    ('- Warn on live unavailable: {0}' -f $gatePolicy.warnOnLiveUnavailable),
    '',
    '## Rules'
) + @($rules | ForEach-Object { "- [$($_.severity)/$($_.gateImpact)] $($_.id): $($_.rule)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
