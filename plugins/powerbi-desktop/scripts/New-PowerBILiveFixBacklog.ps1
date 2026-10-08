param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$insight = & (Join-Path $PSScriptRoot 'Invoke-PowerBILiveInsightScan.ps1') -Server $Server -Json | ConvertFrom-Json
$validation = & (Join-Path $PSScriptRoot 'Test-PowerBILiveMeasures.ps1') -Server $Server -Top 25 -Json | ConvertFrom-Json
$governance = & (Join-Path $PSScriptRoot 'Test-PowerBILiveMetadataGovernance.ps1') -Server $Server -Json | ConvertFrom-Json
$suggestions = & (Join-Path $PSScriptRoot 'New-PowerBILiveRefactorSuggestions.ps1') -Server $Server -Json | ConvertFrom-Json

$items = New-Object System.Collections.Generic.List[object]

function Add-BacklogItem {
    param(
        [string]$Priority,
        [string]$Theme,
        [string]$Title,
        [string]$Source,
        [string]$Why,
        [string]$Action,
        [string]$Validation
    )

    $score = switch ($Priority) {
        'P0' { 400 }
        'P1' { 300 }
        'P2' { 200 }
        'P3' { 100 }
        default { 0 }
    }

    $items.Add([pscustomobject]@{
        priority = $Priority
        score = $score
        theme = $Theme
        title = $Title
        source = $Source
        why = $Why
        action = $Action
        validation = $Validation
    })
}

foreach ($failure in @($validation.results | Where-Object { $_.status -eq 'Failed' })) {
    Add-BacklogItem `
        -Priority 'P0' `
        -Theme 'Broken Measures' `
        -Title ('Fix failing measure `{0}`' -f $failure.name) `
        -Source $failure.name `
        -Why $failure.error `
        -Action 'Open the measure expression, remove invalid filter predicates, and rerun live validation before publishing.' `
        -Validation ('Run Test-PowerBILiveMeasures.ps1 and confirm `{0}` passes.' -f $failure.name)
}

foreach ($suggestion in @($suggestions.suggestions | Where-Object { $_.priority -eq 'High' })) {
    Add-BacklogItem `
        -Priority 'P1' `
        -Theme 'DAX Refactoring' `
        -Title ('Refactor `{0}`: {1}' -f $suggestion.measure, $suggestion.risk) `
        -Source $suggestion.measure `
        -Why ('Risk detected: {0}' -f $suggestion.risk) `
        -Action $suggestion.suggestedAction `
        -Validation $suggestion.validation
}

$localDateFinding = @($governance.findings | Where-Object { $_.title -eq 'Many local date tables' } | Select-Object -First 1)
if ($localDateFinding.Count -gt 0) {
    Add-BacklogItem `
        -Priority 'P1' `
        -Theme 'Model Design' `
        -Title 'Replace auto date tables with a governed date table' `
        -Source 'model' `
        -Why $localDateFinding[0].detail `
        -Action 'Create or designate a governed calendar table, mark it as date table, remap time-intelligence measures, then disable auto date/time where appropriate.' `
        -Validation 'Refresh the model and confirm LocalDateTable object count drops as expected.'
}

$metadataGroups = @($governance.findings | Group-Object title | Sort-Object Count -Descending)
foreach ($group in @($metadataGroups | Select-Object -First 3)) {
    Add-BacklogItem `
        -Priority 'P2' `
        -Theme 'Metric Governance' `
        -Title ('Reduce metadata finding group: {0}' -f $group.Name) `
        -Source 'model' `
        -Why ('Detected {0} occurrences.' -f $group.Count) `
        -Action 'Batch-update measure names, descriptions, visibility, or format strings according to the finding group.' `
        -Validation 'Rerun Test-PowerBILiveMetadataGovernance.ps1 and compare finding counts.'
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveFixBacklog.v1'
    generated = (Get-Date).ToString('s')
    riskLevel = $insight.riskLevel
    riskScore = $insight.riskScore
    itemCount = $items.Count
    items = @($items | Sort-Object score, theme, source -Descending)
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Fix Backlog')
$lines.Add('')
$lines.Add(('Risk level: **{0}**' -f $result.riskLevel))
$lines.Add(('Risk score: **{0}**' -f $result.riskScore))
$lines.Add(('Items: {0}' -f $result.itemCount))
$lines.Add('')
foreach ($item in $result.items) {
    $lines.Add(('## [{0}] {1}' -f $item.priority, $item.title))
    $lines.Add(('- Theme: {0}' -f $item.theme))
    $lines.Add(('- Source: `{0}`' -f $item.source))
    $lines.Add(('- Why: {0}' -f $item.why))
    $lines.Add(('- Action: {0}' -f $item.action))
    $lines.Add(('- Validation: {0}' -f $item.validation))
    $lines.Add('')
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
