param([Parameter(Mandatory)][string]$InputPath,[string]$StorePath='powerbi-decision-store.json',[switch]$Json)
$ErrorActionPreference='Stop'
if(-not(Test-Path -LiteralPath $InputPath)){throw "InputPath not found: $InputPath"}
$incoming=Get-Content -Raw -LiteralPath $InputPath|ConvertFrom-Json
$records=if($incoming.PSObject.Properties.Name -contains 'records'){@($incoming.records)}elseif($incoming.PSObject.Properties.Name -contains 'items'){@($incoming.items)}else{@($incoming)}
$existing=@();if(Test-Path -LiteralPath $StorePath){$existing=@(Get-Content -Raw -LiteralPath $StorePath|ConvertFrom-Json)}
$merged=@($existing+$records|Sort-Object decisionId,metricName,observedAt -Unique)
$storeText=if($merged.Count){$merged|ConvertTo-Json -Depth 12}else{'[]'}
Set-Content -LiteralPath $StorePath -Value $storeText -Encoding UTF8
$result=[pscustomobject]@{schema='codex.powerbi.decisionStore.v1';status='StoredLocally';storePath=(Resolve-Path -LiteralPath $StorePath).Path;addedCount=$records.Count;recordCount=$merged.Count;security='Local file only; select a governed shared store explicitly when required.'}
if($Json){$result|ConvertTo-Json -Depth 8}else{$result}
