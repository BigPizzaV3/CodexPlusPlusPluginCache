param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$service = & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $Path -Json | ConvertFrom-Json
$rls = & (Join-Path $scriptRoot 'New-PowerBIRlsTrustReview.ps1') -Path $Path -Json | ConvertFrom-Json
$contract = & (Join-Path $scriptRoot 'Test-PowerBISemanticContract.ps1') -Path $Path -Json | ConvertFrom-Json
$findings = @()
if ($trust.overallTrustScore -lt 70) { $findings += [pscustomobject]@{ severity = 'High'; area = 'Trust'; message = 'Overall KPI trust is below certification threshold.' } }
if ($service.findingCount -gt 0) { $findings += [pscustomobject]@{ severity = 'Medium'; area = 'ServiceGovernance'; message = 'Service scanner has open governance findings.' } }
if ($rls.status -ne 'Passed') { $findings += [pscustomobject]@{ severity = 'High'; area = 'Security'; message = 'RLS trust review is not passed.' } }
if ($contract.status -ne 'ContractPassed') { $findings += [pscustomobject]@{ severity = 'High'; area = 'SemanticContract'; message = 'Semantic contract is not fully passed.' } }
$result = [pscustomobject]@{ schema = 'codex.powerbi.certifiedDatasetReadiness.v1'; root = $trust.root; generated = (Get-Date).ToString('s'); status = if (@($findings | Where-Object severity -eq 'High').Count -gt 0) { 'NotReady' } elseif ($findings.Count -gt 0) { 'ReadyWithCaveats' } else { 'Ready' }; findingCount = $findings.Count; findings = @($findings) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Certified Dataset Readiness`n`nStatus: **$($result.status)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
