param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'refresh-failures'
$failed=@($s.refreshHistory|Where-Object status -eq 'Failed')
$badGateways=@($s.gateways|Where-Object{ $_.status -ne 'Online' })
$findings=@()
foreach($f in $failed){$findings+=New-FabricFinding High Refresh "Refresh failed for $($f.itemId): $($f.error)"}
foreach($g in $badGateways){$findings+=New-FabricFinding High Gateway "Gateway $($g.name) status is $($g.status)."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricRefreshFailureRootCauseAdvisor.v1';title='Power BI Fabric Refresh Failure Root Cause Advisor';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($failed.Count -or $badGateways.Count){'HighRisk'}else{'NoLikelyFailureDetected'};failedRefreshCount=$failed.Count;findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
