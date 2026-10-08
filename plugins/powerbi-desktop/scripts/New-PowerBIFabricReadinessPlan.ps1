param(
    [string]$Path = ".",
    [string]$WorkspaceName = '[TODO: Fabric workspace]',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -Json | ConvertFrom-Json
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -Json | ConvertFrom-Json
$copilot = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $Path -Json | ConvertFrom-Json

$steps = @(
    [pscustomobject]@{ phase = 'Source Control'; action = 'Store PBIP/TMDL artifacts in Git before Fabric deployment.'; required = $true },
    [pscustomobject]@{ phase = 'Trust Gate'; action = ('Resolve release gate decision: {0}' -f $gate.decision); required = ($gate.decision -ne 'Go') },
    [pscustomobject]@{ phase = 'Copilot'; action = ('Improve semantic model readiness score: {0}' -f $copilot.score); required = ($copilot.score -lt 70) },
    [pscustomobject]@{ phase = 'Workspace'; action = ('Prepare Fabric workspace: {0}' -f $WorkspaceName); required = $true },
    [pscustomobject]@{ phase = 'Deployment'; action = 'Use Fabric/Power BI deployment pipeline after local review artifacts pass.'; required = $true }
)

$result = [pscustomobject]@{
    schema = 'codex.powerbi.fabricReadinessPlan.v1'
    generated = (Get-Date).ToString('s')
    source = (Resolve-Path -LiteralPath $Path).Path
    workspaceName = $WorkspaceName
    pbipReadiness = $structure.readiness
    releaseDecision = $gate.decision
    copilotScore = $copilot.score
    stepCount = @($steps).Count
    steps = $steps
}
if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$md = @('# Power BI Fabric Readiness Plan', '', "Workspace: $WorkspaceName", "Release decision: $($gate.decision)", "Copilot score: $($copilot.score)", '', '## Steps') + @($steps | ForEach-Object { "- [$($_.phase)] $($_.action)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
