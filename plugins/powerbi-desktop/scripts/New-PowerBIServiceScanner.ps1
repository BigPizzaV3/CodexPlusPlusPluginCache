param(
    [string]$Path = ".",
    [string]$WorkspaceName = '[TODO: Fabric workspace]',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolved = (Resolve-Path -LiteralPath $Path).Path

$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $resolved -Json | ConvertFrom-Json
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $resolved -Json | ConvertFrom-Json
$fabric = & (Join-Path $scriptRoot 'New-PowerBIFabricReadinessPlan.ps1') -Path $resolved -WorkspaceName $WorkspaceName -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
$findings.Add([pscustomobject]@{ severity = 'Medium'; category = 'Ownership'; title = 'Workspace ownership must be confirmed'; detail = 'Service scan needs named owners for semantic model, report, refresh, and deployment pipeline.' })
$findings.Add([pscustomobject]@{ severity = 'Medium'; category = 'Refresh'; title = 'Refresh and gateway health not yet proven'; detail = 'Collect refresh history, gateway mapping, and credential owner before release.' })
$findings.Add([pscustomobject]@{ severity = 'Low'; category = 'Governance'; title = 'Sensitivity and endorsement need tenant validation'; detail = 'Verify labels, certification, app audience, and sharing scope in the service.' })
if ($gate.decision -ne 'Go') {
    $findings.Add([pscustomobject]@{ severity = 'High'; category = 'Release Gate'; title = "Trust gate is $($gate.decision)"; detail = 'Resolve local trust gate findings before service rollout.' })
}
if ($structure.readiness -ne 'Ready') {
    $findings.Add([pscustomobject]@{ severity = 'Medium'; category = 'Source Control'; title = "PBIP readiness is $($structure.readiness)"; detail = 'Prefer PBIP/TMDL source before managed service deployment.' })
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.serviceScanner.v1'
    generated = (Get-Date).ToString('s')
    source = $resolved
    workspaceName = $WorkspaceName
    pbipReadiness = $structure.readiness
    releaseDecision = $gate.decision
    fabricStepCount = $fabric.stepCount
    findingCount = $findings.Count
    findings = $findings.ToArray()
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @('# Power BI Service Scanner', '', "Workspace: $WorkspaceName", "Release decision: $($gate.decision)", '', '## Findings') +
    @($findings | ForEach-Object { "- [$($_.severity)] $($_.category): $($_.title) - $($_.detail)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
