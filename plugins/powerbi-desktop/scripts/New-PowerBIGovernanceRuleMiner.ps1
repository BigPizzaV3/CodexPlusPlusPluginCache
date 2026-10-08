param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog=&(Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json|ConvertFrom-Json
$riskGroups=@($catalog.metrics|ForEach-Object{@($_.risks)}|Group-Object|Sort-Object Count -Descending)
$rules=foreach($g in $riskGroups){[pscustomobject]@{name=('mined-{0}' -f (($g.Name -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant())); sourceRisk=$g.Name; occurrenceCount=$g.Count; suggestedSeverity=$(if($g.Name -match 'performance|correctness'){'High'}elseif($g.Name -match 'determinism|maintainability'){'Medium'}else{'Low'}); ruleDraft=[pscustomobject]@{enabled=$true; category='Mined Governance'; title=$g.Name; detail='Mined from repeated model findings.'}}}
$result=[pscustomobject]@{schema='codex.powerbi.governanceRuleMiner.v1'; generated=(Get-Date).ToString('s'); suggestedRuleCount=@($rules).Count; rules=@($rules)}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI Governance Rule Miner','')+@($rules|ForEach-Object{"- [$($_.suggestedSeverity)] $($_.sourceRisk): $($_.occurrenceCount) occurrences"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
