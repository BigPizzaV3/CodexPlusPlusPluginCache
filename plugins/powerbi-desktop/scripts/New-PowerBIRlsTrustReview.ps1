param(
    [string]$Path = ".",
    [string]$RolesPath,
    [string]$OutputPath,
    [switch]$Json,
    [switch]$CheckLive
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rls = if ($RolesPath) {
    & (Join-Path $scriptRoot 'Test-PowerBIRlsLeakage.ps1') -Path $Path -RolesPath $RolesPath -CheckLive:$CheckLive -Json | ConvertFrom-Json
}
else {
    & (Join-Path $scriptRoot 'Test-PowerBIRlsLeakage.ps1') -Path $Path -CheckLive:$CheckLive -Json | ConvertFrom-Json
}

$findings = foreach ($test in @($rls.roleTests)) {
    if ($test.leakageRisk -eq 'High') {
        [pscustomobject]@{ severity = 'High'; role = $test.roleName; message = 'RLS role has no explicit policy evidence.'; recommendation = 'Define allowed/denied slices and validate live before release.' }
    }
    elseif ($test.status -eq 'NeedsLiveValidation') {
        [pscustomobject]@{ severity = 'Medium'; role = $test.roleName; message = 'RLS role needs live validation evidence.'; recommendation = 'Attach role-based DAX result evidence.' }
    }
}

$high = @($findings | Where-Object { $_.severity -eq 'High' }).Count
$result = [pscustomobject]@{
    schema = 'codex.powerbi.rlsTrustReview.v1'
    root = $rls.root
    generated = (Get-Date).ToString('s')
    roleTestCount = $rls.roleTestCount
    highRiskCount = $high
    status = if ($high -gt 0) { 'Blocked' } elseif (@($findings).Count -gt 0) { 'Warn' } else { 'Passed' }
    leakageReview = $rls
    findings = @($findings)
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 10; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI RLS Trust Review', '', ('Status: **{0}**' -f $result.status), '') + @($result.findings | ForEach-Object { '- [{0}] {1}: {2}' -f $_.severity, $_.role, $_.message })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
