param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path
$inventory = & (Join-Path $scriptRoot 'Get-PowerBIInventory.ps1') -Path $root -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $root -Json | ConvertFrom-Json
$usage = & (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $root -Json | ConvertFrom-Json
$risk = & (Join-Path $scriptRoot 'New-PowerBIModelRiskHeatmap.ps1') -Path $root -Json | ConvertFrom-Json
$retirement = & (Join-Path $scriptRoot 'New-PowerBIReportRetirementAdvisor.ps1') -Path $root -Json | ConvertFrom-Json
$result = [pscustomobject]@{
    schema = 'codex.powerbi.portfolioCommandCenter.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    reportFileCount = @($inventory.files).Count
    metricCount = $trust.metricCount
    overallTrustScore = $trust.overallTrustScore
    modelRisk = $risk.overallRisk
    usageTrustPriority = $usage.priority
    retirementCandidateCount = $retirement.candidateCount
    status = if ($risk.overallRisk -ge 70 -or $trust.overallTrustScore -lt 50) { 'PortfolioAtRisk' } elseif ($trust.overallTrustScore -lt 70) { 'NeedsGovernanceReview' } else { 'PortfolioStable' }
    portfolioSignals = @(
        [pscustomobject]@{ area = 'Trust'; value = $trust.overallTrustScore; detail = 'Average KPI trust score.' },
        [pscustomobject]@{ area = 'Risk'; value = $risk.overallRisk; detail = 'Aggregated model risk heatmap score.' },
        [pscustomobject]@{ area = 'UsageTrust'; value = $usage.priority; detail = 'Usage-vs-trust remediation priority.' },
        [pscustomobject]@{ area = 'Retirement'; value = $retirement.candidateCount; detail = 'Reports or metrics that may need retirement review.' }
    )
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Portfolio Command Center', '', ('Status: **{0}**' -f $result.status), ('Trust score: {0}' -f $result.overallTrustScore), ('Model risk: {0}' -f $result.modelRisk))
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
