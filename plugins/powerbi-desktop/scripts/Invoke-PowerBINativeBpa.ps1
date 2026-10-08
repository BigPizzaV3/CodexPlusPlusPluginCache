param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..')).Path
$rules = Get-Content -Raw -LiteralPath (Join-Path $pluginRoot 'rules/powerbi-governance-rules.json') | ConvertFrom-Json
$trustRules = Get-Content -Raw -LiteralPath (Join-Path $pluginRoot 'rules/powerbi-trust-rules.json') | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
foreach ($metric in @($catalog.metrics)) {
    foreach ($rule in @($rules.dax | Where-Object enabled)) {
        if ($metric.expression -match $rule.pattern) {
            $findings.Add([pscustomobject]@{ ruleId = $rule.id; severity = $rule.severity; category = $rule.category; source = $metric.name; title = $rule.title; detail = $rule.detail })
        }
    }
    if ($trustRules.bestPractices.requireMetricOwner -and $metric.owner -match 'TODO') {
        $findings.Add([pscustomobject]@{ ruleId = 'metric.owner'; severity = 'Medium'; category = 'Metric Governance'; source = $metric.name; title = 'Missing metric owner'; detail = 'Assign an accountable owner.' })
    }
    if ($trustRules.bestPractices.requireBusinessDefinition -and $metric.businessDefinition -match 'TODO') {
        $findings.Add([pscustomobject]@{ ruleId = 'metric.definition'; severity = 'Medium'; category = 'Metric Governance'; source = $metric.name; title = 'Missing business definition'; detail = 'Document meaning, grain, filters, and caveats.' })
    }
}
$ruleCount = @($rules.dax).Count + @($rules.powerQuery).Count + 2
$result = [pscustomobject]@{ schema = 'codex.powerbi.nativeBpa.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); ruleCount = $ruleCount; findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Native Best Practice Analyzer', '', "Rules: $ruleCount", "Findings: $($result.findingCount)", '') + @($result.findings | ForEach-Object { "- [$($_.severity)] $($_.source): $($_.title) - $($_.detail)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

