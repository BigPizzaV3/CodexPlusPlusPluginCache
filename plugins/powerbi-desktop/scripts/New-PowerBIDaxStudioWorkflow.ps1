param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tool = @((& (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json).tools | Where-Object name -eq 'DAX Studio' | Select-Object -First 1)
$tests = & (Join-Path $scriptRoot 'New-PowerBIMeasureTestPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$result = [pscustomobject]@{ schema = 'codex.powerbi.daxStudioWorkflow.v1'; tool = $tool; generated = (Get-Date).ToString('s'); queryCount = $tests.testCount; queries = @($tests.tests | Select-Object -First 20); guidance = @('Open DAX Studio against the Desktop model.', 'Enable Server Timings and Query Plan for performance diagnostics.', 'Run generated validation queries before and after DAX changes.') }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# DAX Studio Workflow', '', "Installed: $($tool.installed)", '', '## Guidance') + @($result.guidance | ForEach-Object { "- $_" }) + @('', '## Query Drafts') + @($result.queries | ForEach-Object { '```DAX' + [Environment]::NewLine + $_.daxQuery + [Environment]::NewLine + '```' })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
