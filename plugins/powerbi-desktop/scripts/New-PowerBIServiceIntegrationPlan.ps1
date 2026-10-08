param([string]$WorkspaceName = 'Target Workspace', [string]$DatasetName = 'Dataset', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$checks = @('Workspace inventory', 'Dataset refresh status', 'Deployment pipeline stage', 'Endorsement and sensitivity label', 'App publish impact', 'Gateway and credential readiness')
$result = [pscustomobject]@{ schema = 'codex.powerbi.serviceIntegrationPlan.v1'; workspaceName = $WorkspaceName; datasetName = $DatasetName; generated = (Get-Date).ToString('s'); checks = $checks; note = 'Plan only. Use Power BI REST APIs or Admin APIs with explicit authentication to execute.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Service Integration Plan`n`n" + (($checks | ForEach-Object { "- $_" }) -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

