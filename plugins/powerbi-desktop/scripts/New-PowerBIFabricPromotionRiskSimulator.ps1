param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'deployment-drift'
$drift=@($s.deploymentPipelines|Where-Object{ $_.status -match 'Drift' -or $_.driftCount -gt 0}).Count
$failed=@($s.refreshHistory|Where-Object status -eq 'Failed').Count
$riskScore=($drift*40)+($failed*25)
$findings=@(); if($drift){$findings+=New-FabricFinding High Drift "$drift drift signals would make promotion unsafe."}; if($failed){$findings+=New-FabricFinding Medium Refresh "$failed failed refresh records increase promotion risk."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricPromotionRiskSimulator.v1';title='Power BI Fabric Promotion Risk Simulator';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;riskScore=$riskScore;status=if($riskScore-ge 40){'HighRisk'}elseif($riskScore-gt 0){'MediumRisk'}else{'LowRisk'};findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
