param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$capacity=& (Join-Path $scriptRoot 'New-PowerBIFabricCapacityRiskForecast.ps1') -Path $root -Json|ConvertFrom-Json
$perf=& (Join-Path $scriptRoot 'New-PowerBIPerformanceAdvisor.ps1') -Path $root -Json|ConvertFrom-Json
$items=New-Object System.Collections.Generic.List[object]
foreach($risk in @($capacity.riskItems|Select-Object -First 10)){$items.Add([pscustomobject]@{priority=if($risk.severity -in @('Critical','High')){'P0'}else{'P1'};area=$risk.area;action=$risk.mitigation;expectedEffect='Reduce capacity, refresh, or query risk.';validation='Rerun New-PowerBIFabricCapacityRiskForecast.ps1.'})}
foreach($finding in @($perf.findings|Select-Object -First 10)){$items.Add([pscustomobject]@{priority='P1';area='DAX Performance';action=$finding.recommendation;expectedEffect='Reduce expensive DAX pattern risk.';validation='Benchmark affected visuals/measures with DAX Studio or live DAX benchmark.'})}
$result=[pscustomobject]@{schema='codex.powerbi.capacityMitigationPlanner.v1';generated=(Get-Date).ToString('s');source=$root;capacityRiskLevel=$capacity.capacityRiskLevel;mitigationCount=$items.Count;mitigations=@($items.ToArray())}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI Capacity Mitigation Planner','',"Capacity risk: $($capacity.capacityRiskLevel)",'')+@($items|ForEach-Object{"- [$($_.priority)] $($_.area): $($_.action)"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
