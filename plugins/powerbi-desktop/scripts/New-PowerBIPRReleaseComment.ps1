param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -Json | ConvertFrom-Json
$fixes = & (Join-Path $scriptRoot 'New-PowerBIGuidedFixPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$baseline = & (Join-Path $scriptRoot 'Test-PowerBIGoldenBaselines.ps1') -Json | ConvertFrom-Json
$topFixes = @($fixes.fixes | Select-Object -First 5)
$exitCode = if ($gate.decision -eq 'No-Go' -or $baseline.failedCount -gt 0) { 1 } else { 0 }

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('## Power BI Release Gate')
$lines.Add('')
$lines.Add(('- Decision: **{0}**' -f $gate.decision))
$lines.Add(('- Golden baselines: {0}/{1} passed' -f $baseline.passedCount, $baseline.checkCount))
$lines.Add(('- CI exit code: `{0}`' -f $exitCode))
$lines.Add('')
$lines.Add('### Top blockers')
foreach ($fix in $topFixes) {
    $lines.Add(('- [{0}] {1}: {2}' -f $fix.priority, $fix.title, $fix.source))
}
$comment = ($lines -join [Environment]::NewLine) + [Environment]::NewLine

$result = [pscustomobject]@{
    schema = 'codex.powerbi.prReleaseComment.v1'
    generated = (Get-Date).ToString('s')
    decision = $gate.decision
    exitCode = $exitCode
    comment = $comment
}

if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $comment -Encoding UTF8 }
if ($Json) { $result | ConvertTo-Json -Depth 8; return }
$comment
