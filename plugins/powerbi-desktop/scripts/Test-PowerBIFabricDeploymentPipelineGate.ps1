param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'deployment-drift'
$drift=@($s.deploymentPipelines|Where-Object{ $_.status -match 'Drift' -or $_.driftCount -gt 0 })
$findings=@()
if($drift.Count){$findings+=New-FabricFinding High Deployment "$($drift.Count) deployment pipeline stages show drift."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricDeploymentPipelineGate.v1';title='Power BI Fabric Deployment Pipeline Gate';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;decision=if($drift.Count){'BlockPromotion'}else{'Promote'};status=if($drift.Count){'Blocked'}else{'Passed'};findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
