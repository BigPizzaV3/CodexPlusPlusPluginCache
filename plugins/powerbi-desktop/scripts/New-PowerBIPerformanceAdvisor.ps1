param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach ($metric in @($catalog.metrics)) {
    $patterns = New-Object System.Collections.Generic.List[string]
    if ($metric.expression -match 'FILTER\s*\(\s*ALL\s*\(') { $patterns.Add('FILTER over ALL') }
    if ($metric.expression -match 'ALL\s*\(\s*''[^'']+''\s*\)') { $patterns.Add('ALL over full table') }
    if ($metric.expression -match 'SUMX|AVERAGEX|COUNTX') { $patterns.Add('Iterator usage') }
    if ($metric.expression -match 'TODAY\s*\(|NOW\s*\(') { $patterns.Add('Volatile date/time') }
    if ($patterns.Count -gt 0) {
        [pscustomobject]@{ measure = $metric.name; table = $metric.table; priority = $(if ($patterns -contains 'ALL over full table') { 'P1' } else { 'P2' }); findings = @($patterns); recommendation = 'Benchmark with a narrower filter context and validate totals before publishing.' }
    }
}
$itemArray = @($items)
$result = [pscustomobject]@{ schema = 'codex.powerbi.performanceAdvisor.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); findingCount = $itemArray.Count; findings = $itemArray }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Performance Advisor', '', "Findings: $($result.findingCount)", '') + @($result.findings | ForEach-Object { "## [$($_.priority)] $($_.measure)`n- Findings: $($_.findings -join ', ')`n- Recommendation: $($_.recommendation)`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
