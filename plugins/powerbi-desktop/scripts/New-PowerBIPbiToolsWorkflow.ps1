param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tool = @((& (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json).tools | Where-Object name -eq 'pbi-tools' | Select-Object -First 1)
$commands = @('pbi-tools extract <report.pbix> -extractFolder <folder>', 'pbi-tools compile <folder> -format PBIX', 'pbi-tools deploy <folder>')
$steps = @('Use pbi-tools to extract PBIX only when source PBIP is unavailable.', 'Commit extracted text artifacts, not generated review outputs.', 'Run auto-review and trust release gate before compile/deploy.')
$result = [pscustomobject]@{ schema = 'codex.powerbi.pbiToolsWorkflow.v1'; tool = $tool; generated = (Get-Date).ToString('s'); commands = $commands; steps = $steps }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# pbi-tools Workflow`n`nInstalled: $($tool.installed)`n`n## Commands`n" + (($commands | ForEach-Object { "- `$_" }) -join [Environment]::NewLine) + "`n`n## Steps`n" + (($steps | ForEach-Object { "- $_" }) -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

