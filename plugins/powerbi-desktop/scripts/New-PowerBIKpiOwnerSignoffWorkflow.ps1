param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$debt=& (Join-Path $scriptRoot 'New-PowerBITrustDebtLedger.ps1') -Path $root -Json|ConvertFrom-Json
$contract=& (Join-Path $scriptRoot 'New-PowerBIKpiTrustContract.ps1') -Path $root -Json|ConvertFrom-Json
$incident=& (Join-Path $scriptRoot 'New-PowerBIKpiIncidentReport.ps1') -Path $root -Json|ConvertFrom-Json
$items=foreach($item in @($debt.debtItems)){
  $contractItem=@($contract.contracts|Where-Object metric -eq $item.metric|Select-Object -First 1)
  $incidentItem=@($incident.affectedMeasures|Where-Object name -eq $item.metric|Select-Object -First 1)
  [pscustomobject]@{
    metric=$item.metric; severity=$item.severity; status='PendingOwnerDecision'; ownerHint=if($contractItem.owner){$contractItem.owner}else{'Metric owner'}
    dueDate=$item.dueDate; trustScore=$item.trustScore; releaseBlocker=$item.releaseBlocker
    requiredDecision=if($item.releaseBlocker){'Approve remediation, reject release, or grant documented waiver.'}else{'Confirm owner, definition, and validation evidence.'}
    evidence=@($item.sourceSignals + @("incidentRootCauseCount:$(@($incidentItem.rootCauseCount)[0])"))
  }
}
$result=[pscustomobject]@{schema='codex.powerbi.kpiOwnerSignoffWorkflow.v1';generated=(Get-Date).ToString('s');source=$root;signoffItemCount=@($items).Count;pendingCount=@($items|Where-Object status -eq 'PendingOwnerDecision').Count;items=@($items)}
if($Json){$text=$result|ConvertTo-Json -Depth 10;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI KPI Owner Sign-off Workflow','',"Pending: $($result.pendingCount)",'')+@($items|ForEach-Object{"- [$($_.severity)] $($_.metric): $($_.requiredDecision)"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
