param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$semantic = & (Join-Path $scriptRoot 'New-PowerBIBusinessSemanticLayer.ps1') -Path $Path -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach ($metric in @($trust.metrics)) {
    $sem = @($semantic.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    [pscustomobject]@{
        metric = $metric.name
        trustScore = $metric.trustScore
        decisionContext = $sem.decisionContext
        affectedDecision = $(if ($metric.trustScore -lt 60) { 'Executive decisions using this KPI may be misleading.' } elseif ($metric.trustScore -lt 80) { 'Decision can proceed only with validation caveat.' } else { 'Low technical decision risk after sign-off.' })
        affectedAudience = $(if ($sem.decisionContext -match 'Financial') { 'Finance and executive leadership' } elseif ($sem.decisionContext -match 'Customer') { 'Customer success and operations leadership' } else { 'Report consumers and BI owners' })
        requiredAction = $(if ($metric.trustScore -lt 60) { 'Block from release view or remediate before publication.' } elseif ($metric.trustScore -lt 80) { 'Add validation note and owner sign-off.' } else { 'Keep monitoring through release gate.' })
    }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.decisionRiskAssistant.v1'; root = $trust.root; generated = (Get-Date).ToString('s'); riskCount = @($items).Count; decisionRisks = @($items | Sort-Object trustScore, metric) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Decision Risk Assistant', '') + @($result.decisionRisks | ForEach-Object { "## $($_.metric)`n- Trust score: $($_.trustScore)`n- Decision risk: $($_.affectedDecision)`n- Audience: $($_.affectedAudience)`n- Required action: $($_.requiredAction)`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

