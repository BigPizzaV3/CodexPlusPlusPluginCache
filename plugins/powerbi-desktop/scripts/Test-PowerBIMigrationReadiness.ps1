param(
    [string]$Path = ".",
    [string]$Target = "Fabric",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -Json | ConvertFrom-Json
$fabric = & (Join-Path $scriptRoot 'New-PowerBIFabricReadinessPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$env = & (Join-Path $scriptRoot 'Test-PowerBIEnvironment.ps1') -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
if ($structure.roundtripStatus -ne 'Ready') {
    $findings.Add([pscustomobject]@{ severity = 'High'; area = 'PBIP'; message = 'PBIP structure is not ready for reliable source-controlled migration.'; recommendation = 'Export to PBIP and complete semantic/report metadata before migration.' }) | Out-Null
}
foreach ($step in @($fabric.steps | Select-Object -First 5)) {
    $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'Fabric'; message = (($step.title, $step.name, 'Fabric readiness step') | Where-Object { $_ })[0]; recommendation = (($step.action, $step.description, 'Complete readiness step.') | Where-Object { $_ })[0] }) | Out-Null
}
if ($env.AdomdClient -and -not $env.AdomdClient.Available) {
    $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'Tooling'; message = 'ADOMD.NET provider is not available for live validation.'; recommendation = 'Install a supported ADOMD provider before live migration validation.' }) | Out-Null
}

$high = @($findings.ToArray() | Where-Object { $_.severity -eq 'High' }).Count
$result = [pscustomobject]@{
    schema = 'codex.powerbi.migrationReadiness.v1'
    root = $structure.root
    generated = (Get-Date).ToString('s')
    target = $Target
    pbipRoundtripStatus = $structure.roundtripStatus
    fabricStepCount = $fabric.stepCount
    findingCount = $findings.Count
    status = if ($high -gt 0) { 'NotReady' } elseif ($findings.Count -gt 0) { 'ReadyWithActions' } else { 'Ready' }
    findings = @($findings.ToArray())
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Migration Readiness', '', ('Status: **{0}**' -f $result.status), '') + @($result.findings | ForEach-Object { '- [{0}] {1}: {2}' -f $_.severity, $_.area, $_.message })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
