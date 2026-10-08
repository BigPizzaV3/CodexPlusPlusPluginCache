param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$service=& (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $root -Json|ConvertFrom-Json
$capacity=& (Join-Path $scriptRoot 'New-PowerBIFabricCapacityRiskForecast.ps1') -Path $root -Json|ConvertFrom-Json
$dependency=& (Join-Path $scriptRoot 'New-PowerBIDependencyGraph.ps1') -Path $root -Json|ConvertFrom-Json
$usage=& (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $root -Json|ConvertFrom-Json
$affected=@($usage.matrixItems|Sort-Object @{Expression='trustScore';Ascending=$true}|Select-Object -First 10|ForEach-Object{
 [pscustomobject]@{metric=$_.metricName;trustScore=$_.trustScore;usageBand=$_.usageBand;priority=$_.priority;dependencyEdges=@($dependency.edges|Where-Object{$_.from -eq $_.metricName -or $_.to -eq $_.metricName}).Count}
})
$result=[pscustomobject]@{schema='codex.powerbi.refreshBlastRadius.v1';generated=(Get-Date).ToString('s');source=$root;refreshRisk=$capacity.refreshRisk;capacityRiskLevel=$capacity.capacityRiskLevel;serviceFindingCount=$service.findingCount;affectedKpiCount=@($affected).Count;affectedKpis=@($affected);escalation=if($capacity.refreshRisk -ge 70){'Escalate refresh/capacity risk before release.'}else{'Monitor refresh evidence in next release.'}}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI Refresh Blast Radius','',"Refresh risk: $($result.refreshRisk)",'')+@($affected|ForEach-Object{"- [$($_.priority)] $($_.metric): trust=$($_.trustScore), usage=$($_.usageBand)"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
