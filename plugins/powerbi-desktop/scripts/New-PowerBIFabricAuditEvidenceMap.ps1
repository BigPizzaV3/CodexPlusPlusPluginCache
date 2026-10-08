param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'security-exposure'
$evidence=@(
 [pscustomobject]@{area='Ownership';count=@($s.items|Where-Object owner).Count},
 [pscustomobject]@{area='Sensitivity';count=@($s.items|Where-Object sensitivityLabel).Count},
 [pscustomobject]@{area='Lineage';count=$s.lineage.Count},
 [pscustomobject]@{area='Refresh';count=$s.refreshHistory.Count}
)
$gaps=@($evidence|Where-Object count -eq 0)
$findings=@($gaps|ForEach-Object{New-FabricFinding Medium Audit "$($_.area) evidence is missing from snapshot."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricAuditEvidenceMap.v1';title='Power BI Fabric Audit Evidence Map';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($gaps.Count){'EvidenceGaps'}else{'EvidenceMapped'};evidence=$evidence;findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
