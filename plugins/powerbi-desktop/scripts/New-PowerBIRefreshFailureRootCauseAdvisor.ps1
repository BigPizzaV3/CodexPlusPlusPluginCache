param([string]$Path = ".", [string]$RefreshExportPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pq = & (Join-Path $scriptRoot 'Test-PowerBIPowerQueryDataContract.ps1') -Path $Path -Json | ConvertFrom-Json
$blast = & (Join-Path $scriptRoot 'New-PowerBIRefreshBlastRadiusAnalyzer.ps1') -Path $Path -Json | ConvertFrom-Json
$findings = @($pq.findings | ForEach-Object { [pscustomobject]@{ severity = $_.severity; probableCause = $_.area; evidence = $_.message; nextCheck = 'Validate source credentials, gateway mapping, schema drift, and query folding.' } })
if (-not $RefreshExportPath -or -not (Test-Path -LiteralPath $RefreshExportPath)) { $findings += [pscustomobject]@{ severity = 'Medium'; probableCause = 'MissingRefreshExport'; evidence = 'Refresh history export not supplied.'; nextCheck = 'Attach refresh history CSV/JSON for failed-refresh pattern matching.' } }
$result = [pscustomobject]@{ schema = 'codex.powerbi.refreshFailureRootCauseAdvisor.v1'; root = (Resolve-Path -LiteralPath $Path).Path; generated = (Get-Date).ToString('s'); refreshExportStatus = if ($RefreshExportPath -and (Test-Path -LiteralPath $RefreshExportPath)) { 'Available' } else { 'NeedsExport' }; blastRadiusStatus = $blast.status; findingCount = @($findings).Count; status = if (@($findings | Where-Object severity -eq 'High').Count -gt 0) { 'HighRisk' } elseif (@($findings).Count -gt 0) { 'NeedsEvidence' } else { 'NoLikelyFailureDetected' }; findings = @($findings) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Refresh Failure Root Cause Advisor`n`nStatus: **$($result.status)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
