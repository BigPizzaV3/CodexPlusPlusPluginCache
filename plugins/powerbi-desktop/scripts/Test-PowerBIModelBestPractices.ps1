param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..')).Path
$trustRulesPath = Join-Path $pluginRoot 'rules/powerbi-trust-rules.json'
$rules = Get-Content -Raw -LiteralPath $trustRulesPath | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$scan = & (Join-Path $scriptRoot 'Invoke-PowerBIInsightScan.ps1') -Path $Path -Json | ConvertFrom-Json
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
foreach ($metric in @($catalog.metrics)) {
    if ($rules.bestPractices.requireMetricOwner -and $metric.owner -match 'TODO') {
        $findings.Add([pscustomobject]@{ severity = 'Medium'; category = 'Metric Governance'; source = $metric.name; message = 'Metric owner is missing.'; recommendation = 'Assign a business or BI owner before release.' })
    }
    if ($rules.bestPractices.requireBusinessDefinition -and $metric.businessDefinition -match 'TODO') {
        $findings.Add([pscustomobject]@{ severity = 'Medium'; category = 'Metric Governance'; source = $metric.name; message = 'Business definition is missing.'; recommendation = 'Document business meaning, grain, and accepted filters.' })
    }
    if ($rules.bestPractices.discourageVolatileTimeFunctions -and $metric.expression -match '\bTODAY\s*\(|\bNOW\s*\(') {
        $findings.Add([pscustomobject]@{ severity = 'Medium'; category = 'DAX Determinism'; source = $metric.name; message = 'Volatile date/time function detected.'; recommendation = 'Use a governed date table or refresh parameter.' })
    }
    if ($rules.bestPractices.discourageFilterAllOnFactTables -and $metric.expression -match 'FILTER\s*\(\s*ALL\s*\(') {
        $findings.Add([pscustomobject]@{ severity = 'High'; category = 'DAX Performance'; source = $metric.name; message = 'FILTER over ALL pattern detected.'; recommendation = 'Use narrower REMOVEFILTERS/KEEPFILTERS semantics where possible.' })
    }
}
if ($rules.bestPractices.requirePbipForSourceControl -and $structure.score -lt 70) {
    $findings.Add([pscustomobject]@{ severity = 'High'; category = 'Source Control'; source = 'model'; message = 'PBIP/TMDL readiness is below strong threshold.'; recommendation = 'Export to PBIP/TMDL for reliable review and source control.' })
}

$penalty = 0
foreach ($finding in $findings) {
    $penalty += if ($finding.severity -eq 'High') { 15 } elseif ($finding.severity -eq 'Medium') { 8 } else { 3 }
}
$score = [math]::Max(0, 100 - $penalty)
$result = [pscustomobject]@{
    schema = 'codex.powerbi.modelBestPractices.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    score = [int]$score
    riskScore = $scan.riskScore
    findingCount = $findings.Count
    findings = @($findings.ToArray())
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = @('# Power BI Model Best Practices', '', "Score: **$($result.score)**", '', "Findings: $($result.findingCount)", '') + @($result.findings | ForEach-Object { "- [$($_.severity)] $($_.category) `$($_.source)`: $($_.message) $($_.recommendation)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

