param([string]$SnapshotDirectory, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'portfolio-risk'
$failed=@($s.refreshHistory|Where-Object status -eq 'Failed').Count
$offline=@($s.gateways|Where-Object { $_.status -ne 'Online' }).Count
$highCapacity=@($s.capacities|Where-Object { $_.utilizationPct -ge 85 }).Count
$findings=@()
if($failed){$findings+=New-FabricFinding High Refresh "$failed refresh failures detected."}
if($offline){$findings+=New-FabricFinding High Gateway "$offline gateways are not online."}
if($highCapacity){$findings+=New-FabricFinding Medium Capacity "$highCapacity capacities show high utilization."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricWorkspaceRiskRadar.v1';title='Power BI Fabric Workspace Risk Radar';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if(@($findings|Where-Object severity -eq 'High').Count){'HighRisk'}elseif($findings.Count){'MediumRisk'}else{'LowRisk'};findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
