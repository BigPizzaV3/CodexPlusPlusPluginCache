param([string]$Path = ".", [string]$OutputDirectory = "powerbi-ai-governance-evidence", [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Path).Path
$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $source -Json | ConvertFrom-Json
$debt = & (Join-Path $scriptRoot 'New-PowerBITrustDebtLedger.ps1') -Path $source -Json | ConvertFrom-Json
$change = & (Join-Path $scriptRoot 'Update-PowerBIChangeJournal.ps1') -Title 'AI governance evidence review' -Status proposed -Json | ConvertFrom-Json
$fix = & (Join-Path $scriptRoot 'Invoke-PowerBIAutonomousFixAgent.ps1') -Path $source -Json | ConvertFrom-Json
$signoffGaps = @($debt.items | Where-Object { $_.owner -match 'TODO|Unassigned|Unknown' -or $_.status -ne 'Closed' })
$residualRisks = @($gate.checks | Where-Object { $_.status -ne 'Pass' })
$summary = [pscustomobject]@{
    schema = 'codex.powerbi.aiGovernanceEvidencePack.v1'
    generated = (Get-Date).ToString('s')
    source = $source
    outputDirectory = $out
    releaseDecision = $gate.decision
    aiSuggestionCount = $fix.fixCount
    acceptedCount = 0
    rejectedCount = 0
    signoffGapCount = @($signoffGaps).Count
    residualRiskCount = @($residualRisks).Count
    changeJournalStatus = $change.status
}
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'summary.json') -Encoding UTF8
@('# AI Suggestions','') + @($fix.fixes | ForEach-Object { "- $($_.measure): $($_.risk) -> $($_.applyStatus)" }) | Set-Content -LiteralPath (Join-Path $out 'ai-suggestions.md') -Encoding UTF8
@('# Signoff Gaps','') + @($signoffGaps | ForEach-Object { "- $($_.metric): owner/status evidence required." }) | Set-Content -LiteralPath (Join-Path $out 'signoff-gaps.md') -Encoding UTF8
@('# Residual Risks','') + @($residualRisks | ForEach-Object { "- [$($_.status)] $($_.name): $($_.detail)" }) | Set-Content -LiteralPath (Join-Path $out 'residual-risks.md') -Encoding UTF8
@('# Release Evidence','', "Decision: **$($gate.decision)**", "Release note: $($gate.releaseNote)") | Set-Content -LiteralPath (Join-Path $out 'release-evidence.md') -Encoding UTF8
if ($Json) { $text = $summary | ConvertTo-Json -Depth 10; $text; return }
$summary
