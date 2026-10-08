param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Path).Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $source -Json | ConvertFrom-Json
$copilot = & (Join-Path $scriptRoot 'Optimize-PowerBICopilotModel.ps1') -Path $source -Json | ConvertFrom-Json
$contracts = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustContract.ps1') -Path $source -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'New-PowerBIBusinessSemanticLayer.ps1') -Path $source -Json | ConvertFrom-Json
$readiness = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $source -Json | ConvertFrom-Json

$actions = foreach ($metric in @($catalog.metrics)) {
    $suggestion = @($copilot.suggestions | Where-Object { $_.measure -eq $metric.name } | Select-Object -First 1)
    $contract = @($contracts.contracts | Where-Object { $_.metric -eq $metric.name } | Select-Object -First 1)
    $sem = @($semantic.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    [pscustomobject]@{
        measure = $metric.name
        actionType = if (@($metric.risks).Count -gt 0) { 'HardenBeforeCopilot' } else { 'PublishSemanticMetadata' }
        suggestedDisplayName = if ($suggestion) { $suggestion.suggestedDisplayName } else { $metric.name }
        suggestedDescription = if ($suggestion) { $suggestion.suggestedDescription } else { ('Business KPI measuring {0}.' -f $metric.name) }
        synonyms = if ($suggestion) { @($suggestion.synonyms) } else { @($metric.name) }
        ownerStatus = if ($metric.owner -match 'TODO') { 'Missing' } else { 'Present' }
        definitionStatus = if ($metric.businessDefinition -match 'TODO') { 'Missing' } else { 'Present' }
        visibilityRecommendation = if ($suggestion) { $suggestion.visibility } else { 'Visible after validation' }
        contractAction = if ($contract) { $contract.acceptanceTest } elseif ($sem) { $sem.requiredSignoff } else { 'Create KPI trust contract.' }
    }
}
$score = if ($readiness.PSObject.Properties.Name -contains 'score') { [int]$readiness.score } elseif ($readiness.PSObject.Properties.Name -contains 'overallScore') { [int]$readiness.overallScore } else { [math]::Max(0, 100 - (@($actions | Where-Object { $_.ownerStatus -eq 'Missing' -or $_.definitionStatus -eq 'Missing' }).Count * 10)) }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.semanticLayerAutopilot.v1'
    generated = (Get-Date).ToString('s')
    source = $source
    metricCount = @($catalog.metrics).Count
    autopilotActions = @($actions)
    readinessScore = $score
    copilotReadinessBand = if ($score -ge 80) { 'Ready' } elseif ($score -ge 60) { 'NeedsMetadata' } else { 'NotReady' }
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 10; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Semantic Layer Autopilot', '', "Readiness: **$($result.copilotReadinessBand)** ($($result.readinessScore))", '') + @($result.autopilotActions | ForEach-Object { "## $($_.measure)`n- Action: $($_.actionType)`n- Display name: $($_.suggestedDisplayName)`n- Description: $($_.suggestedDescription)`n- Visibility: $($_.visibilityRecommendation)`n- Contract: $($_.contractAction)`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
