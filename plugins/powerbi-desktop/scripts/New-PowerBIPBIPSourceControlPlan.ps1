param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -Json | ConvertFrom-Json
$steps = @('Export PBIX to PBIP before editing.', 'Commit SemanticModel and Report text artifacts.', 'Ignore generated review outputs.', 'Run native BPA, Trust Release Gate, and Pester before PR.', 'Use PBIP-to-PBIX workflow only after validation.')
$result = [pscustomobject]@{ schema = 'codex.powerbi.pbipSourceControlPlan.v1'; root = (Resolve-Path -LiteralPath $Path).Path; generated = (Get-Date).ToString('s'); readiness = $structure.readiness; score = $structure.score; steps = $steps }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI PBIP Source Control Plan`n`nReadiness: $($structure.readiness) ($($structure.score)/100)`n`n" + (($steps | ForEach-Object { "- $_" }) -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

