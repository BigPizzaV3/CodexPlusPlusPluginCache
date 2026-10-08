param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$suggestions = & (Join-Path $PSScriptRoot 'New-PowerBILiveRefactorSuggestions.ps1') -Server $Server -Json | ConvertFrom-Json

function ConvertTo-DaxDraft {
    param([string]$Expression, [string]$Risk)

    $draft = $Expression
    $notes = New-Object System.Collections.Generic.List[string]

    if ($Risk -match 'COUNTIF') {
        $notes.Add('COUNTIF is not valid DAX. Replace each occurrence with CALCULATE(COUNTROWS(...), filter predicates) after confirming the target table and filter semantics.')
        $draft = "/* DRAFT: replace COUNTIF with CALCULATE + COUNTROWS after business validation. */`n" + $draft
    }
    if ($Risk -match 'TODAY|volatile') {
        $notes.Add('Volatile TODAY/NOW changes by query date. Prefer a governed refresh-date measure or a date-table driven filter.')
        $draft = $draft -replace '(?i)\bTODAY\s*\(\s*\)', '[As Of Date]'
        $draft = $draft -replace '(?i)\bNOW\s*\(\s*\)', '[As Of DateTime]'
    }
    if ($Risk -match 'FILTER over ALL') {
        $notes.Add('FILTER(ALL(...)) can over-clear context. Replace ALL(table) with REMOVEFILTERS(required columns) or a smaller dimension scope where semantics allow.')
        $draft = $draft -replace '(?i)FILTER\s*\(\s*ALL\s*\(\s*([^)]+)\s*\)', 'FILTER(REMOVEFILTERS($1)'
    }
    if ($Risk -match 'ALL over fact table') {
        $notes.Add('ALL over a fact table is usually too broad. Clear only the columns or dimensions required by the calculation.')
        $draft = $draft -replace '(?i)ALL\s*\(\s*IncidentsAllFields\s*\)', 'REMOVEFILTERS(/* TODO: choose required IncidentsAllFields columns, not full fact table */)'
    }
    if ($Risk -match 'long expression') {
        $notes.Add('Split long expressions into helper measures with explicit business names and descriptions.')
        $draft = "/* DRAFT: extract helper measures for reusable business logic before finalizing. */`n" + $draft
    }
    if ($notes.Count -eq 0) {
        $notes.Add('No deterministic rewrite pattern is available. Treat this as a guided review draft.')
    }

    [pscustomobject]@{
        draftExpression = $draft
        notes = @($notes.ToArray())
    }
}

$drafts = foreach ($suggestion in @($suggestions.suggestions | Where-Object { $_.priority -in @('High', 'Medium') })) {
    $converted = ConvertTo-DaxDraft -Expression $suggestion.expression -Risk $suggestion.risk
    [pscustomobject]@{
        measure = $suggestion.measure
        table = $suggestion.table
        priority = $suggestion.priority
        risk = $suggestion.risk
        notes = $converted.notes
        originalExpression = $suggestion.expression
        draftExpression = $converted.draftExpression
        validation = $suggestion.validation
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveDaxFixDrafts.v1'
    generated = (Get-Date).ToString('s')
    draftCount = @($drafts).Count
    drafts = @($drafts)
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live DAX Fix Drafts')
$lines.Add('')
$lines.Add(('Drafts: {0}' -f $result.draftCount))
$lines.Add('')
$lines.Add('These are implementation drafts, not blind patches. Validate every rewrite against accepted business totals before replacing production measures.')
$lines.Add('')
foreach ($draft in $result.drafts) {
    $lines.Add(('## [{0}] {1}' -f $draft.priority, $draft.measure))
    $lines.Add(('- Table: {0}' -f $draft.table))
    $lines.Add(('- Risk: {0}' -f $draft.risk))
    foreach ($note in @($draft.notes)) {
        $lines.Add(('- Note: {0}' -f $note))
    }
    $lines.Add('')
    $lines.Add('### Original')
    $lines.Add('')
    $lines.Add('```DAX')
    $lines.Add($draft.originalExpression)
    $lines.Add('```')
    $lines.Add('')
    $lines.Add('### Draft')
    $lines.Add('')
    $lines.Add('```DAX')
    $lines.Add($draft.draftExpression)
    $lines.Add('```')
    $lines.Add('')
    $lines.Add(('- Validation: {0}' -f $draft.validation))
    $lines.Add('')
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
