param([string]$Path = ".", [string]$ReviewDirectory, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path
$releaseGate = if ($ReviewDirectory -and (Test-Path -LiteralPath (Join-Path $ReviewDirectory 'trust-release-gate.json'))) { Get-Content -Raw -LiteralPath (Join-Path $ReviewDirectory 'trust-release-gate.json') | ConvertFrom-Json } else { & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $root -Json | ConvertFrom-Json }
$semantic = if ($ReviewDirectory -and (Test-Path -LiteralPath (Join-Path $ReviewDirectory 'semantic-tests.json'))) { Get-Content -Raw -LiteralPath (Join-Path $ReviewDirectory 'semantic-tests.json') | ConvertFrom-Json } else { & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $root -Json | ConvertFrom-Json }
$rollback = & (Join-Path $scriptRoot 'Test-PowerBIPBIPRollbackReadiness.ps1') -PbipPath $root -Json | ConvertFrom-Json
$findings = New-Object System.Collections.Generic.List[object]
if ($releaseGate.decision -eq 'No-Go') { $findings.Add([pscustomobject]@{ severity = 'High'; area = 'ReleaseGate'; message = 'Trust release gate is No-Go.' }) | Out-Null }
if ($semantic.pendingCount -gt 0 -or @($semantic.tests | Where-Object { $_.status -eq 'Generated' }).Count -gt 0) { $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'SemanticTests'; message = 'Semantic tests include pending/generated expectations.' }) | Out-Null }
if ($rollback.status -ne 'Ready') { $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'Rollback'; message = 'PBIP rollback readiness is incomplete.' }) | Out-Null }
$high = @($findings.ToArray() | Where-Object severity -eq 'High').Count
$result = [pscustomobject]@{ schema = 'codex.powerbi.deploymentPipelineGate.v1'; root = $root; generated = (Get-Date).ToString('s'); decision = if ($high -gt 0) { 'BlockPromotion' } elseif ($findings.Count -gt 0) { 'PromoteWithCaveats' } else { 'Promote' }; findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Deployment Pipeline Gate`n`nDecision: **$($result.decision)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
