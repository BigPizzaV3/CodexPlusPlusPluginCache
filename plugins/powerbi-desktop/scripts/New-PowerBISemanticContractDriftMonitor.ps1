param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$contract=& (Join-Path $scriptRoot 'New-PowerBIKpiTrustContract.ps1') -Path $root -Json|ConvertFrom-Json
$catalog=& (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json|ConvertFrom-Json
$usage=& (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $root -Json|ConvertFrom-Json
$drift=foreach($metric in @($catalog.metrics)){
 $contractItem=@($contract.contracts|Where-Object metric -eq $metric.name|Select-Object -First 1)
 $usageItem=@($usage.matrixItems|Where-Object metricName -eq $metric.name|Select-Object -First 1)
 $issues=@()
 if(-not $contractItem){$issues+='Missing contract'}
 if($metric.owner -match 'TODO'){$issues+='Missing owner'}
 if($metric.businessDefinition -match 'TODO'){$issues+='Missing business definition'}
 if($usageItem -and $usageItem.trustScore -lt 80){$issues+='Usage/trust requires contract review'}
 if($issues.Count -gt 0){[pscustomobject]@{metric=$metric.name;table=$metric.table;driftCount=$issues.Count;issues=@($issues);ownerDecision='Confirm contract, update definition, or approve waiver.'}}
}
$result=[pscustomobject]@{schema='codex.powerbi.semanticContractDriftMonitor.v1';generated=(Get-Date).ToString('s');source=$root;driftCount=@($drift).Count;drifts=@($drift)}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI Semantic Contract Drift Monitor','',"Drifts: $($result.driftCount)",'')+@($drift|ForEach-Object{"- $($_.metric): $($_.issues -join '; ')"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
