param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'minimal'
$models=@($s.items|Where-Object type -eq 'SemanticModel')
$findings=@()
foreach($m in $models){if($m.endorsement -ne 'Certified'){$findings+=New-FabricFinding Medium Certification "$($m.name) is not certified."}; if(-not $m.owner){$findings+=New-FabricFinding High Ownership "$($m.name) has no owner."}; if(-not $m.sensitivityLabel){$findings+=New-FabricFinding Medium Sensitivity "$($m.name) has no sensitivity label."}}
$result=[pscustomobject]@{schema='codex.powerbi.fabricCertifiedDatasetReadiness.v1';title='Power BI Fabric Certified Dataset Readiness';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if(@($findings|Where-Object severity -eq 'High').Count){'NotReady'}elseif($findings.Count){'ReadyWithCaveats'}else{'Ready'};modelCount=$models.Count;findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
