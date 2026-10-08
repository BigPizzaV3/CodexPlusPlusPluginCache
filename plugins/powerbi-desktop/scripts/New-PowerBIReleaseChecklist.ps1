param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scorecard = & (Join-Path $scriptRoot 'New-PowerBIModelGovernanceScorecard.ps1') -Path $Path -Json | ConvertFrom-Json
$copilot = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $Path -Json | ConvertFrom-Json
$fixes = & (Join-Path $scriptRoot 'New-PowerBIGuidedFixPlan.ps1') -Path $Path -Json | ConvertFrom-Json
$items = @(
    [pscustomobject]@{ area = 'Measures'; status = $(if (($fixes.fixes | Where-Object priority -eq 'P0').Count -eq 0) { 'Pass' } else { 'Review' }); check = 'No P0 guided fixes remain.' },
    [pscustomobject]@{ area = 'Governance'; status = $(if ($scorecard.overallScore -ge 70) { 'Pass' } else { 'Review' }); check = 'Governance score is release-ready.' },
    [pscustomobject]@{ area = 'Copilot'; status = $(if ($copilot.score -ge 70) { 'Pass' } else { 'Review' }); check = 'Model has business-readable semantics.' },
    [pscustomobject]@{ area = 'Validation'; status = 'Manual'; check = 'Open report in Power BI Desktop and validate visuals.' },
    [pscustomobject]@{ area = 'Rollback'; status = 'Manual'; check = 'Keep a tagged release or backup before publishing.' }
)
$result = [pscustomobject]@{ schema = 'codex.powerbi.releaseChecklist.v1'; root = $scorecard.root; generated = (Get-Date).ToString('s'); itemCount = $items.Count; items = $items }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Release Checklist', '') + @($items | ForEach-Object { "- [$($_.status)] $($_.area): $($_.check)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

