param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$inventory = & (Join-Path $scriptRoot 'Get-PowerBIInventory.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$graph = & (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $Path -Json | ConvertFrom-Json
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -Json | ConvertFrom-Json
$sections = @('Inventory','PBIP Readiness','Metric Catalog','Dependency Graph','Governance Notes')
$result = [pscustomobject]@{ schema = 'codex.powerbi.nativeModelDocumentation.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); sectionCount = $sections.Count; sections = $sections; fileCount = @($inventory.files).Count; metricCount = $catalog.metricCount; dependencyCount = $graph.edgeCount; readiness = $structure.readiness }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Native Model Documentation', '', "Readiness: **$($structure.readiness)**", "Metrics: $($catalog.metricCount)", "Dependencies: $($graph.edgeCount)", '', '## Metrics') + @($catalog.metrics | ForEach-Object { "- `$($_.table)[$($_.name)]`: $($_.validationQuestion)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

