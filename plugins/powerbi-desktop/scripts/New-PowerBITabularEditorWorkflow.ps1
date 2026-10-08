param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tool = @((& (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json).tools | Where-Object name -eq 'Tabular Editor' | Select-Object -First 1)
$steps = @('Open the PBIP/TMDL model or connect to the local Desktop model.', 'Run Best Practice Analyzer rules.', 'Apply generated measure/column drafts only after source-control backup.', 'Validate changed measures and dependent visuals.', 'Commit PBIP/TMDL changes.')
$commands = @()
if ($tool.installed) { $commands += ('"{0}"' -f $tool.path) }
$result = [pscustomobject]@{ schema = 'codex.powerbi.tabularEditorWorkflow.v1'; tool = $tool; path = $Path; generated = (Get-Date).ToString('s'); steps = $steps; commands = $commands }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Tabular Editor Workflow`n`nInstalled: $($tool.installed)`n`n" + (($steps | ForEach-Object { "- $_" }) -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

