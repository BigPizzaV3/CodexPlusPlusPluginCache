param([string]$Path = ".", [string]$ComparisonPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$comparePath = if ($ComparisonPath) { $ComparisonPath } else { $Path }
$conflicts = & (Join-Path $scriptRoot 'New-PowerBICrossReportKpiConflictDetector.ps1') -Path $Path -ComparisonPath $comparePath -Json | ConvertFrom-Json
$duplicates = & (Join-Path $scriptRoot 'Find-PowerBIMetricDuplicates.ps1') -Path $Path -Json | ConvertFrom-Json
$recommendations = @()
foreach ($conflict in @($conflicts.conflicts)) {
    $recommendations += [pscustomobject]@{ kpi = (($conflict.metricName, $conflict.name, 'Unknown KPI') | Where-Object { $_ })[0]; action = 'Choose a canonical definition and create migration tasks for non-canonical measures.'; ownerDecision = 'Required' }
}
foreach ($dup in @($duplicates.duplicates)) {
    $recommendations += [pscustomobject]@{ kpi = (($dup.name, $dup.metricName, 'Duplicate metric') | Where-Object { $_ })[0]; action = 'Consolidate duplicate semantic definitions or document accepted divergence.'; ownerDecision = 'Required' }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.kpiDefinitionConflictResolution.v1'; root = (Resolve-Path -LiteralPath $Path).Path; generated = (Get-Date).ToString('s'); conflictCount = @($recommendations).Count; status = if (@($recommendations).Count -gt 0) { 'NeedsOwnerDecision' } else { 'NoConflictDetected' }; recommendations = @($recommendations) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI KPI Definition Conflict Resolution`n`nStatus: **$($result.status)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
