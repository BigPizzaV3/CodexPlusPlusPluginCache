param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Path).Path
$decision = & (Join-Path $scriptRoot 'New-PowerBIDecisionRiskAssistant.ps1') -Path $source -Json | ConvertFrom-Json
$simulator = & (Join-Path $scriptRoot 'New-PowerBIReportDecisionSimulator.ps1') -Path $source -Json | ConvertFrom-Json
$intent = & (Join-Path $scriptRoot 'New-PowerBIVisualIntentAnalyzer.ps1') -Path $source -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $source -Json | ConvertFrom-Json

$scenarios = foreach ($risk in @($decision.decisionRisks)) {
    $metricTrust = @($trust.metrics | Where-Object { $_.name -eq $risk.metric } | Select-Object -First 1)
    $intentHit = @($intent.intents | Select-Object -First 1)
    $trustRisk = if ($risk.trustScore -lt 60) { 'High' } elseif ($risk.trustScore -lt 80) { 'Medium' } else { 'Low' }
    [pscustomobject]@{
        decision = if ($intentHit) { $intentHit.intendedDecision } else { $risk.decisionContext }
        audience = $risk.affectedAudience
        supportingKpis = @($risk.metric)
        trustRisk = $trustRisk
        narrativeRisk = if (@($intent.findings).Count -gt 0) { 'Review' } else { 'Low' }
        possibleWrongDecision = if ($trustRisk -eq 'High') { ('Misjudge {0} because KPI trust is below release threshold.' -f $risk.metric) } else { ('Use {0} with validation caveats.' -f $risk.metric) }
        requiredEvidence = @($risk.requiredAction, $(if ($metricTrust) { @($metricTrust.deductions) -join '; ' } else { 'Metric trust evidence' }))
        confidenceBand = if ($risk.trustScore -ge 80) { 'High' } elseif ($risk.trustScore -ge 60) { 'Medium' } else { 'Low' }
    }
}
if (@($scenarios).Count -eq 0) { $scenarios = @($simulator.scenarios) }
$confidenceScore = if (@($trust.metrics).Count -gt 0) { [math]::Round((@($trust.metrics | Measure-Object -Property trustScore -Average).Average), 0) } else { 0 }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.businessOutcomeSimulator.v1'
    generated = (Get-Date).ToString('s')
    source = $source
    scenarioCount = @($scenarios).Count
    scenarios = @($scenarios)
    overallDecisionConfidence = if ($confidenceScore -ge 80) { 'High' } elseif ($confidenceScore -ge 60) { 'Medium' } else { 'Low' }
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 10; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Business Outcome Simulator', '', "Overall decision confidence: **$($result.overallDecisionConfidence)**", '') + @($result.scenarios | ForEach-Object { "## $($_.decision)`n- Audience: $($_.audience)`n- KPIs: $($_.supportingKpis -join ', ')`n- Trust risk: $($_.trustRisk)`n- Possible wrong decision: $($_.possibleWrongDecision)`n- Evidence: $($_.requiredEvidence -join '; ')`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
