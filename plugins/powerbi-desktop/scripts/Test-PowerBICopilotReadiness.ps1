param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$technical = @($catalog.metrics | Where-Object { $_.name -match '^_|[a-z][A-Z]|ID$' })
$todos = @($catalog.metrics | Where-Object { $_.owner -match 'TODO' -or $_.businessDefinition -match 'TODO' })
$score = [math]::Max(0, 100 - ($technical.Count * 10) - ($todos.Count * 8))
$result = [pscustomobject]@{ schema = 'codex.powerbi.copilotReadiness.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); score = [int]$score; findingCount = $technical.Count + $todos.Count; findings = @(@($technical | ForEach-Object { [pscustomobject]@{ type = 'Technical measure name'; source = $_.name; recommendation = 'Use business-readable names or hide technical measures.' } }) + @($todos | ForEach-Object { [pscustomobject]@{ type = 'Missing semantic definition'; source = $_.name; recommendation = 'Add owner, business definition, synonyms, and description.' } })) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Copilot Readiness', '', "Score: **$($result.score)**", '', '## Findings') + @($result.findings | ForEach-Object { "- $($_.type): `$($_.source)` - $($_.recommendation)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

