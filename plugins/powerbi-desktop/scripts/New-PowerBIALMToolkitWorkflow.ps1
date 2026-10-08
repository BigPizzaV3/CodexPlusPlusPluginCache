param([string]$SourcePath = ".", [string]$TargetPath = "", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tool = @((& (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json).tools | Where-Object name -eq 'ALM Toolkit' | Select-Object -First 1)
$steps = @('Open source and target datasets/models in ALM Toolkit.', 'Compare metadata changes before deployment.', 'Review measure, relationship, role, and partition differences.', 'Export comparison evidence for release approval.', 'Deploy only after Trust Release Gate passes.')
$result = [pscustomobject]@{ schema = 'codex.powerbi.almToolkitWorkflow.v1'; tool = $tool; sourcePath = $SourcePath; targetPath = $TargetPath; generated = (Get-Date).ToString('s'); steps = $steps }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# ALM Toolkit Workflow`n`nInstalled: $($tool.installed)`n`n" + (($steps | ForEach-Object { "- $_" }) -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

