param(
    [string]$Path = ".",
    [string]$OutputDirectory = "powerbi-ai-pack"
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

$scan = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$graph = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -Json | ConvertFrom-Json
$plan = & (Join-Path $scriptRoot 'New-PowerBIRefactorPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$blueprint = & (Join-Path $scriptRoot 'New-PowerBIReportBlueprint.ps1') -Path $Path -Json | ConvertFrom-Json

$context = [pscustomobject]@{
    schema = 'codex.powerbi.aiContextPack.v1'
    root = $scan.Root
    generated = (Get-Date).ToString('s')
    risk = @{
        level = $scan.RiskLevel
        score = $scan.RiskScore
        findings = $scan.Findings
    }
    metricCatalog = $catalog
    dependencyGraph = $graph
    refactorPlan = $plan
    reportBlueprint = $blueprint
}

$contextPath = Join-Path $resolvedOut 'context-pack.json'
$context | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $contextPath -Encoding UTF8

$systemPrompt = @'
You are a senior Power BI architect. Use only the provided context pack unless the user supplies additional files. Treat heuristic findings as triage signals. Do not claim a PBIX was modified unless an explicit text-based PBIP/TMDL/DAX/PQ edit was made and validated.
'@

$reviewPrompt = @"
# AI Review Prompt

Use `context-pack.json` to review this Power BI project.

Prioritize:
- correctness of metric definitions
- DAX maintainability and dependency impact
- refresh reliability
- PBIP/TMDL source-control readiness
- executive report usability

Return:
1. top five risks
2. highest-leverage fixes
3. metrics needing owner/business-definition sign-off
4. dependency graph implications
5. validation plan
"@

$rewritePrompt = @"
# AI Refactoring Prompt

Use `context-pack.json` to propose safe, text-based refactors.

Rules:
- do not edit binary PBIX/PBIT files
- propose exact DAX or Power Query replacements only when the source and target are clear
- include before/after snippets
- classify each change as safe, medium-risk, or high-risk
- include validation and rollback notes
"@

$narrativePrompt = @"
# AI Executive Narrative Prompt

Use `context-pack.json` to write a concise executive summary for report owners.

Include:
- current risk level
- business impact of the findings
- why metric ownership matters
- the first three actions to take
- what should not be changed until validated
"@

Set-Content -LiteralPath (Join-Path $resolvedOut 'system.md') -Value $systemPrompt -Encoding UTF8
Set-Content -LiteralPath (Join-Path $resolvedOut 'review-prompt.md') -Value $reviewPrompt -Encoding UTF8
Set-Content -LiteralPath (Join-Path $resolvedOut 'refactor-prompt.md') -Value $rewritePrompt -Encoding UTF8
Set-Content -LiteralPath (Join-Path $resolvedOut 'executive-narrative-prompt.md') -Value $narrativePrompt -Encoding UTF8

[pscustomobject]@{
    OutputDirectory = $resolvedOut
    Files = @(
        $contextPath,
        (Join-Path $resolvedOut 'system.md'),
        (Join-Path $resolvedOut 'review-prompt.md'),
        (Join-Path $resolvedOut 'refactor-prompt.md'),
        (Join-Path $resolvedOut 'executive-narrative-prompt.md')
    )
}
