param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog=&(Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json|ConvertFrom-Json
$lineage=&(Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json|ConvertFrom-Json
$items=foreach($m in @($catalog.metrics|Where-Object{@($_.risks).Count -gt 0})){ $impact=@($lineage.measures|Where-Object name -eq $m.name|Select-Object -First 1); [pscustomobject]@{measure=$m.name; risks=@($m.risks); rootCause=$(if($m.expression -match 'EARLIER'){'Legacy row-context pattern'}elseif($m.expression -match 'TODAY|NOW'){'Volatile date/time dependency'}elseif($m.expression -match 'FILTER\s*\(\s*ALL'){'Over-broad filter clearing'}else{'Manual DAX review required'}); upstream=if($impact){@($impact[0].upstreamMeasures)}else{@()}; downstream=if($impact){@($impact[0].downstreamMeasures)}else{@()}; fixOrder=$(if($impact -and $impact[0].downstreamCount -gt 0){'Fix before dependent measures'}else{'Fix locally'})}}
$result=[pscustomobject]@{schema='codex.powerbi.brokenMeasureRootCauseGraph.v1'; generated=(Get-Date).ToString('s'); rootCauseCount=@($items).Count; rootCauses=@($items)}
if($Json){$text=$result|ConvertTo-Json -Depth 10;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI Broken Measure Root Cause Graph','')+@($items|ForEach-Object{"## $($_.measure)`n- Root cause: $($_.rootCause)`n- Fix order: $($_.fixOrder)`n"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
