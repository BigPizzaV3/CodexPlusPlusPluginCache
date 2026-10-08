param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scanScript = Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1'
$scan = & $scanScript -Path $Path -Json | ConvertFrom-Json

function Get-PlanItem {
    param($Finding)

    $effort = switch ($Finding.Title) {
        'FILTER over ALL pattern' { 'Medium' }
        'Volatile date/time function' { 'Small' }
        'Local file dependency' { 'Medium' }
        'Binary report file' { 'Medium' }
        'No text-based model artifacts' { 'Large' }
        'Text artifacts without PBIP file' { 'Small' }
        default { 'Small' }
    }

    $phase = switch ($Finding.Severity) {
        'High' { 'Stabilize' }
        'Medium' { 'Govern' }
        default { 'Polish' }
    }

    $action = switch ($Finding.Title) {
        'FILTER over ALL pattern' { 'Review the measure filter shape, benchmark alternatives, and prefer narrower filter expressions where business logic allows.' }
        'Volatile date/time function' { 'Replace volatile date logic with a governed date table, parameter, or documented refresh-date measure.' }
        'Local file dependency' { 'Move the source to governed storage or parameterize the path for gateway-compatible refresh.' }
        'Binary report file' { 'Export to PBIP before structural edits so diffs and reviews are meaningful.' }
        'No text-based model artifacts' { 'Create a text-based project export before requesting semantic refactors.' }
        'Text artifacts without PBIP file' { 'Add or regenerate the PBIP entry point for round-tripping in Power BI Desktop.' }
        default { 'Review the finding and decide whether it should become a tracked change.' }
    }

    [pscustomobject]@{
        Phase = $phase
        Priority = $Finding.Severity
        Effort = $effort
        Category = $Finding.Category
        Source = $Finding.Source
        Title = $Finding.Title
        Action = $action
        AcceptanceCriteria = @(
            'Change is traceable to a finding or business requirement.',
            'Report opens successfully in Power BI Desktop.',
            'Affected measures or queries have been reviewed against expected results.',
            'Rollback path is documented before publishing.'
        )
    }
}

$items = @($scan.Findings | ForEach-Object { Get-PlanItem -Finding $_ })
$plan = [pscustomobject]@{
    schema = 'codex.powerbi.refactorPlan.v1'
    root = $scan.Root
    generated = (Get-Date).ToString('s')
    riskLevel = $scan.RiskLevel
    riskScore = $scan.RiskScore
    itemCount = $items.Count
    items = $items
}

if ($Json) {
    $jsonText = $plan | ConvertTo-Json -Depth 8
    if ($OutputPath) {
        Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8
    }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Refactoring Plan')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $plan.schema))
$lines.Add(('Root: `{0}`' -f $plan.root))
$lines.Add(('Risk: **{0}** ({1})' -f $plan.riskLevel, $plan.riskScore))
$lines.Add('')
foreach ($phase in @('Stabilize', 'Govern', 'Polish')) {
    $phaseItems = @($items | Where-Object { $_.Phase -eq $phase })
    $lines.Add(('## {0}' -f $phase))
    $lines.Add('')
    if ($phaseItems.Count -eq 0) {
        $lines.Add('No items in this phase.')
        $lines.Add('')
        continue
    }
    foreach ($item in $phaseItems) {
        $lines.Add(('### [{0}] {1}' -f $item.Priority, $item.Title))
        $lines.Add('')
        $lines.Add(('- Category: {0}' -f $item.Category))
        $lines.Add(('- Source: `{0}`' -f $item.Source))
        $lines.Add(('- Effort: {0}' -f $item.Effort))
        $lines.Add(('- Action: {0}' -f $item.Action))
        $lines.Add('- Acceptance criteria:')
        foreach ($criteria in $item.AcceptanceCriteria) {
            $lines.Add(('  - {0}' -f $criteria))
        }
        $lines.Add('')
    }
}

$markdown = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8
}
$markdown
