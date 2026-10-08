param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$suggestions = foreach ($metric in @($catalog.metrics)) {
    [pscustomobject]@{ measure = $metric.name; suggestedDisplayName = (($metric.name -replace '^_', '') -replace '_', ' '); suggestedDescription = ('Business KPI measuring {0}. Confirm definition with owner before enabling Q&A.' -f $metric.name); synonyms = @($metric.name, ($metric.name -replace '%', 'percent'), ($metric.name -replace 'YoY', 'year over year')); visibility = $(if (@($metric.risks).Count -gt 0) { 'Hide until validated' } else { 'Visible for Q&A' }) }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.copilotOptimization.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); suggestionCount = @($suggestions).Count; suggestions = @($suggestions) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Copilot Optimization Engine', '') + @($result.suggestions | ForEach-Object { "## $($_.measure)`n- Display name: $($_.suggestedDisplayName)`n- Description: $($_.suggestedDescription)`n- Synonyms: $($_.synonyms -join ', ')`n- Visibility: $($_.visibility)`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

