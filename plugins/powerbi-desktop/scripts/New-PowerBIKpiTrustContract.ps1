param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'New-PowerBIBusinessSemanticLayer.ps1') -Path $Path -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json

$contracts = foreach ($metric in @($catalog.metrics)) {
    $sem = @($semantic.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    $score = @($trust.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    [pscustomobject]@{
        measure = $metric.name
        table = $metric.table
        owner = $metric.owner
        businessDefinition = $metric.businessDefinition
        grain = '[TODO: business grain]'
        allowedFilters = @('[TODO: allowed filters]')
        sourceSystem = '[TODO: source system]'
        sla = '[TODO: data freshness SLA]'
        acceptanceTest = $metric.validationQuestion
        trustScore = if ($score.Count -gt 0) { $score[0].trustScore } else { $null }
        decisionContext = if ($sem.Count -gt 0) { $sem[0].decisionContext } else { $null }
        risks = @($metric.risks)
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.kpiTrustContract.v1'
    generated = (Get-Date).ToString('s')
    metricCount = @($contracts).Count
    contracts = @($contracts)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI KPI Trust Contract')
$md.Add('')
foreach ($contract in $result.contracts) {
    $md.Add(('## {0}' -f $contract.measure))
    $md.Add(('- Owner: {0}' -f $contract.owner))
    $md.Add(('- Trust score: {0}' -f $contract.trustScore))
    $md.Add(('- Grain: {0}' -f $contract.grain))
    $md.Add(('- Acceptance test: {0}' -f $contract.acceptanceTest))
    $md.Add(('- Risks: {0}' -f ($(if ($contract.risks.Count) { $contract.risks -join '; ' } else { 'none' }))))
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
