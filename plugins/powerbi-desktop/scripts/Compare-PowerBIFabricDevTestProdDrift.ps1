param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'deployment-drift'
$drift=@($s.deploymentPipelines|Where-Object{ $_.status -match 'Drift' -or $_.driftCount -gt 0})
$findings=@($drift|ForEach-Object{New-FabricFinding High Deployment "$($_.name) stage $($_.stage) has drift count $($_.driftCount)."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricDevTestProdDrift.v1';title='Power BI Fabric Dev/Test/Prod Drift';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($drift.Count){'DriftDetected'}else{'NoDrift'};driftCount=$drift.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
