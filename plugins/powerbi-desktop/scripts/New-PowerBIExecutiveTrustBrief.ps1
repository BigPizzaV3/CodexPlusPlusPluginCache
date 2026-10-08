param(
    [string]$Path = ".",
    [string]$ReviewDirectory,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$methodology = & (Join-Path $scriptRoot 'Test-PowerBIAnalysisMethodology.ps1') -Path $Path -ReviewDirectory $ReviewDirectory -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$freshness = & (Join-Path $scriptRoot 'Test-PowerBIDataFreshnessLineageGate.ps1') -Path $Path -ReviewDirectory $ReviewDirectory -Json | ConvertFrom-Json
$rls = & (Join-Path $scriptRoot 'New-PowerBIRlsTrustReview.ps1') -Path $Path -Json | ConvertFrom-Json

$decision = if ($methodology.assessment -eq 'NeedsRevision' -or $freshness.status -eq 'Blocked' -or $rls.status -eq 'Blocked') { 'No-Go' } elseif ($methodology.assessment -eq 'ShareWithCaveats' -or $freshness.status -eq 'Warn' -or $trust.overallTrustScore -lt 70) { 'Conditional Go' } else { 'Go' }
$topRisks = @(
    @($methodology.findings | Select-Object -First 3 | ForEach-Object { [pscustomobject]@{ area = 'Methodology'; severity = $_.severity; message = $_.message } }),
    @($freshness.findings | Select-Object -First 3 | ForEach-Object { [pscustomobject]@{ area = 'FreshnessLineage'; severity = $_.severity; message = $_.message } }),
    @($rls.findings | Select-Object -First 3 | ForEach-Object { [pscustomobject]@{ area = 'Security'; severity = $_.severity; message = $_.message } })
)

$markdownLines = @(
    '# Power BI Executive Trust Brief',
    '',
    ('## Decision: {0}' -f $decision),
    '',
    ('- KPI trust score: {0}' -f $trust.overallTrustScore),
    ('- Methodology assessment: {0}' -f $methodology.assessment),
    ('- Freshness and lineage gate: {0}' -f $freshness.status),
    ('- Security trust review: {0}' -f $rls.status),
    '',
    '## Top Risks'
) + @($topRisks | Where-Object { $_ } | Select-Object -First 8 | ForEach-Object { '- [{0}] {1}: {2}' -f $_.severity, $_.area, $_.message }) + @(
    '',
    '## Next Actions',
    '- Resolve blocking methodology, freshness, lineage, and security findings before broad stakeholder release.',
    '- Attach semantic test evidence and owner sign-off for low-trust KPIs.'
)
$markdown = ($markdownLines -join [Environment]::NewLine) + [Environment]::NewLine
$result = [pscustomobject]@{
    schema = 'codex.powerbi.executiveTrustBrief.v1'
    root = $trust.root
    generated = (Get-Date).ToString('s')
    decision = $decision
    overallTrustScore = $trust.overallTrustScore
    methodologyAssessment = $methodology.assessment
    freshnessLineageStatus = $freshness.status
    rlsTrustStatus = $rls.status
    topRiskCount = @($topRisks | Where-Object { $_ }).Count
    topRisks = @($topRisks | Where-Object { $_ })
    markdown = $markdown
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8 }
$markdown
