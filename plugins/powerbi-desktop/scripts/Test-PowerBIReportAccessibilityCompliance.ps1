param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ux = & (Join-Path $scriptRoot 'New-PowerBIReportUXCritic.ps1') -Path $Path -Json | ConvertFrom-Json
$theme = & (Join-Path $scriptRoot 'New-PowerBIThemeAudit.ps1') -Path $Path -Json | ConvertFrom-Json
$render = & (Join-Path $scriptRoot 'Test-PowerBIReportRenderReadiness.ps1') -Path $Path -Json | ConvertFrom-Json
$findings = @()
if ($ux.findingCount -gt 0) { $findings += @($ux.findings | ForEach-Object { [pscustomobject]@{ severity = $_.severity; area = 'UX'; message = $_.message } }) }
if ($theme.findingCount -gt 0) { $findings += @($theme.findings | ForEach-Object { [pscustomobject]@{ severity = $_.severity; area = 'Theme'; message = $_.message } }) }
if ($render.status -ne 'Ready') { $findings += [pscustomobject]@{ severity = 'Medium'; area = 'RenderReadiness'; message = 'Render readiness is not fully confirmed.' } }
$result = [pscustomobject]@{ schema = 'codex.powerbi.reportAccessibilityCompliance.v1'; root = (Resolve-Path -LiteralPath $Path).Path; generated = (Get-Date).ToString('s'); status = if (@($findings | Where-Object severity -eq 'High').Count -gt 0) { 'Blocked' } elseif ($findings.Count -gt 0) { 'NeedsReview' } else { 'Passed' }; findingCount = $findings.Count; findings = @($findings) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Report Accessibility Compliance`n`nStatus: **$($result.status)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
