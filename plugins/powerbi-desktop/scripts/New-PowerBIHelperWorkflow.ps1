param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$inventory = & (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json
$helper = @($inventory.tools | Where-Object name -eq 'Power BI Helper' | Select-Object -First 1)
$documenter = @($inventory.tools | Where-Object name -eq 'Model Documenter' | Select-Object -First 1)
$steps = @('Generate local plugin model summary and metric catalog.', 'Use Power BI Helper or Model Documenter for complementary report/model documentation if installed.', 'Compare external documentation with Trust Score and Decision Risk outputs.', 'Attach documentation artifacts to release evidence.')
$result = [pscustomobject]@{ schema = 'codex.powerbi.helperWorkflow.v1'; powerBIHelper = $helper; modelDocumenter = $documenter; generated = (Get-Date).ToString('s'); steps = $steps }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Helper / Model Documenter Workflow`n`nPower BI Helper installed: $($helper.installed)`nModel Documenter installed: $($documenter.installed)`n`n" + (($steps | ForEach-Object { "- $_" }) -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

