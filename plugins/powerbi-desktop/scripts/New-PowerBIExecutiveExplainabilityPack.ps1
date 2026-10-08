param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$impact = & (Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json | ConvertFrom-Json
$trusted = @($catalog.metrics | Where-Object { @($_.risks).Count -eq 0 })
$risky = @($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 })
$result = [pscustomobject]@{
    schema = 'codex.powerbi.executiveExplainabilityPack.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    summary = ('The model exposes {0} metrics; {1} have review findings.' -f $catalog.metricCount, $risky.Count)
    trustworthyMetrics = @($trusted | Select-Object name, table, validationQuestion)
    riskyMetrics = @($risky | Select-Object name, table, risks, validationQuestion)
    highImpactMetrics = @($impact.measures | Sort-Object -Property impactScore -Descending | Select-Object -First 5)
    decisionGuidance = @('Use trusted metrics for routine reporting after owner sign-off.', 'Treat risky or high-impact metrics as provisional until validated.', 'Do not publish refactored measures without before/after comparison.')
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Executive Explainability Pack'); $md.Add(''); $md.Add($result.summary); $md.Add('')
$md.Add('## Trustworthy Metrics'); foreach ($m in $result.trustworthyMetrics) { $md.Add(('- `{0}`: {1}' -f $m.name, $m.validationQuestion)) }
$md.Add(''); $md.Add('## Risky Metrics'); foreach ($m in $result.riskyMetrics) { $md.Add(('- `{0}`: {1}' -f $m.name, (@($m.risks) -join '; '))) }
$md.Add(''); $md.Add('## Decision Guidance'); foreach ($g in $result.decisionGuidance) { $md.Add(('- {0}' -f $g)) }
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

