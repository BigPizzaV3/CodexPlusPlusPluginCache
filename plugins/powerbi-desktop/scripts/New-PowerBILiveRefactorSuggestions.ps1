param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$catalog = & (Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1') -Server $Server -Json | ConvertFrom-Json

$suggestions = foreach ($metric in @($catalog.metrics | Where-Object { $_.riskLevel -eq 'review' })) {
    foreach ($risk in @($metric.risks)) {
        $action = switch -Regex ($risk) {
            'COUNTIF' { 'Rewrite using CALCULATE with COUNTROWS/FILTER or a native DAX aggregation. COUNTIF is not a standard DAX function.'; break }
            'TODAY|volatile' { 'Replace volatile TODAY/NOW logic with a governed refresh-date measure, model parameter, or date table filter.'; break }
            'FILTER over ALL' { 'Benchmark a narrower filter expression. Prefer REMOVEFILTERS on required columns or KEEPFILTERS when semantics allow.'; break }
            'ALL over fact table' { 'Avoid clearing filters on the full fact table. Clear only the required dimension or column filters.'; break }
            'long expression' { 'Extract reusable business logic into helper measures and add comments/description.'; break }
            default { 'Review and refactor with business-owner validation.' }
        }
        [pscustomobject]@{
            measure = $metric.name
            table = $metric.table
            risk = $risk
            priority = if ($risk -match 'correctness|performance') { 'High' } elseif ($risk -match 'determinism|maintainability') { 'Medium' } else { 'Low' }
            suggestedAction = $action
            validation = 'Validate the measure in Power BI Desktop, compare against accepted totals, and check dependent measures before publishing.'
            expression = $metric.expression
        }
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveRefactorSuggestions.v1'
    generated = (Get-Date).ToString('s')
    suggestionCount = @($suggestions).Count
    suggestions = @($suggestions)
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Refactor Suggestions')
$lines.Add('')
$lines.Add(('Suggestions: {0}' -f $result.suggestionCount))
$lines.Add('')
foreach ($suggestion in $result.suggestions) {
    $lines.Add(('## [{0}] {1}' -f $suggestion.priority, $suggestion.measure))
    $lines.Add(('- Table: {0}' -f $suggestion.table))
    $lines.Add(('- Risk: {0}' -f $suggestion.risk))
    $lines.Add(('- Suggested action: {0}' -f $suggestion.suggestedAction))
    $lines.Add(('- Validation: {0}' -f $suggestion.validation))
    $lines.Add('')
    $lines.Add('```DAX')
    $lines.Add($suggestion.expression)
    $lines.Add('```')
    $lines.Add('')
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
