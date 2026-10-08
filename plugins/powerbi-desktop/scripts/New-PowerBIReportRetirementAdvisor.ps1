param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$usage=& (Join-Path $scriptRoot 'Import-PowerBIUsageSignals.ps1') -Path $root -Json|ConvertFrom-Json
$debt=& (Join-Path $scriptRoot 'New-PowerBITrustDebtLedger.ps1') -Path $root -Json|ConvertFrom-Json
$dups=& (Join-Path $scriptRoot 'Find-PowerBIMetricDuplicates.ps1') -Path $root -Json|ConvertFrom-Json
$candidates=foreach($item in @($debt.debtItems|Where-Object{$_.trustScore -lt 80}|Select-Object -First 15)){
 [pscustomobject]@{artifact=$item.metric;type='KPI';usageStatus=$usage.status;trustScore=$item.trustScore;duplicateGroupCount=$dups.duplicateGroupCount;recommendation=if($usage.status -eq 'EmptyImport'){'Collect usage evidence before retirement decision.'}elseif($item.trustScore -lt 60){'Re-owner, merge, or retire if low usage.'}else{'Monitor for consolidation.'}}
}
$result=[pscustomobject]@{schema='codex.powerbi.reportRetirementAdvisor.v1';generated=(Get-Date).ToString('s');source=$root;candidateCount=@($candidates).Count;usageStatus=$usage.status;candidates=@($candidates)}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI Report Usage Decay And Retirement Advisor','',"Candidates: $($result.candidateCount)",'')+@($candidates|ForEach-Object{"- $($_.artifact): $($_.recommendation)"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
