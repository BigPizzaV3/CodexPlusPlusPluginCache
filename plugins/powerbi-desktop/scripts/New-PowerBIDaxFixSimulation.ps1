param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$tests = & (Join-Path $scriptRoot 'New-PowerBIMeasureTestPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach ($metric in @($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 })) {
    $draft = $metric.expression -replace 'FILTER\s*\(\s*ALL\s*\(', 'FILTER ( REMOVEFILTERS ('
    [pscustomobject]@{ measure = $metric.name; originalDax = $metric.expression; simulatedDax = $draft; expectedEffect = 'Narrower filter clearing or deterministic behavior, subject to business validation.'; risk = (@($metric.risks) -join '; '); validationQueries = @($tests.tests | Where-Object { $_.measure -eq $metric.name } | Select-Object -ExpandProperty daxQuery); rollbackNote = 'Restore original DAX expression if before/after validation exceeds tolerance.' }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.daxFixSimulation.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); simulationCount = @($items).Count; simulations = @($items) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI DAX Fix Simulation', '') + @($result.simulations | ForEach-Object { "## $($_.measure)`n- Risk: $($_.risk)`n- Expected effect: $($_.expectedEffect)`n- Rollback: $($_.rollbackNote)`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

