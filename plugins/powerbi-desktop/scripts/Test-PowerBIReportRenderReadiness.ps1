param([string]$Path = ".", [string]$ScreenshotPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$schema = & (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'Test-PowerBIVisualSchema.ps1') -Path $Path -Json | ConvertFrom-Json
$schemaPass = (($schema.findings | Where-Object severity -eq 'High').Count -eq 0)
$screenshotStatus = if ($ScreenshotPath -and (Test-Path -LiteralPath $ScreenshotPath)) { 'Pass' } elseif ($ScreenshotPath) { 'Fail' } else { 'Required' }
$checks = @(
    [pscustomobject]@{ name = 'PBIP visual JSON parses'; status = $(if ($schemaPass) { 'Pass' } else { 'Fail' }) },
    [pscustomobject]@{ name = 'Manual Desktop render validation'; status = 'Required' },
    [pscustomobject]@{ name = 'Screenshot inspection'; status = $screenshotStatus; path = $ScreenshotPath }
)
$evidenceMaturity = if ($schemaPass -and $screenshotStatus -eq 'Pass') { 'EvidenceBacked' } elseif ($schemaPass) { 'MetadataOnly' } else { 'Blocked' }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.reportRenderReadiness.v1'
    generated = (Get-Date).ToString('s')
    checkCount = $checks.Count
    checks = $checks
    evidenceMaturity = $evidenceMaturity
    readyForAutomatedPublish = $false
    readinessNote = 'Automated publish is intentionally disabled; use this as render evidence plus manual Desktop validation.'
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result
