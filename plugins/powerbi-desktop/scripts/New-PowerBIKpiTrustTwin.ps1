param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog=&(Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json|ConvertFrom-Json
$contract=&(Join-Path $scriptRoot 'New-PowerBIKpiTrustContract.ps1') -Path $Path -Json|ConvertFrom-Json
$lineage=&(Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json|ConvertFrom-Json
$twins=foreach($m in @($catalog.metrics)){ $c=@($contract.contracts|Where-Object measure -eq $m.name|Select-Object -First 1); $l=@($lineage.measures|Where-Object name -eq $m.name|Select-Object -First 1); [pscustomobject]@{measure=$m.name; dax=$m.expression; contract=if($c){$c[0]}else{$null}; dependencies=if($l){$l[0]}else{$null}; trustHistory=@([pscustomobject]@{date=(Get-Date).ToString('s'); state='Generated'; riskCount=@($m.risks).Count}); releaseHistory=@()}}
$result=[pscustomobject]@{schema='codex.powerbi.kpiTrustTwin.v1'; generated=(Get-Date).ToString('s'); twinCount=@($twins).Count; twins=@($twins)}
if($Json){$text=$result|ConvertTo-Json -Depth 12;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI KPI Trust Twins','')+@($twins|ForEach-Object{"- `$($_.measure)`: risk events=$(@($_.trustHistory).Count)"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
