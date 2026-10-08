param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$blueprint = & (Join-Path $scriptRoot 'New-PowerBIReportBlueprint.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$findings = New-Object System.Collections.Generic.List[object]
if ($blueprint.pageCount -lt 3) { $findings.Add([pscustomobject]@{ severity = 'Medium'; theme = 'Story coverage'; message = 'Report blueprint has fewer than three narrative pages.'; recommendation = 'Include overview, diagnostic, and action/backlog pages.' }) }
if (($catalog.metrics | Where-Object { $_.tags -contains 'ratio' }).Count -eq 0) { $findings.Add([pscustomobject]@{ severity = 'Low'; theme = 'Context'; message = 'No ratio metrics detected.'; recommendation = 'Add relative context where absolute KPIs need interpretation.' }) }
if (($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 }).Count -gt 0) { $findings.Add([pscustomobject]@{ severity = 'High'; theme = 'Executive confidence'; message = 'Risky metrics appear in the semantic layer.'; recommendation = 'Add caveats or remove from executive narrative until validated.' }) }
$result = [pscustomobject]@{ schema = 'codex.powerbi.reportNarrativeCritic.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Report Narrative Critic', '') + @($result.findings | ForEach-Object { "- [$($_.severity)] $($_.theme): $($_.message) $($_.recommendation)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

