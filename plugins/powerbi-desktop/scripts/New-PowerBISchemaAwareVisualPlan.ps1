param([string]$Path = ".", [string]$Measure, [string]$CategoryColumn, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$metric = @($catalog.metrics | Where-Object { $_.name -eq $Measure } | Select-Object -First 1)
$visualType = if ($Measure -match '%|Rate|Ratio|Pct|YoY') { 'LineChart' } elseif ($CategoryColumn) { 'BarChart' } else { 'KpiCard' }
$result = [pscustomobject]@{ schema = 'codex.powerbi.schemaAwareVisualPlan.v1'; root = $catalog.root; measure = $Measure; categoryColumn = $CategoryColumn; metricFound = [bool]$metric; recommendation = [pscustomobject]@{ visualType = $visualType; reason = 'Selected from metric naming/tags and available category column.'; requiredFields = @($Measure, $CategoryColumn | Where-Object { $_ }) }; caveat = 'For robust schema-aware visuals, export PBIP with column metadata and validate data types/cardinality.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

