param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'minimal'
$nodes=@($s.items|ForEach-Object{[pscustomobject]@{id=$_.id;type=$_.type;label=$_.name;owner=$_.owner;labelName=$_.sensitivityLabel}})
$edges=@($s.lineage|ForEach-Object{[pscustomobject]@{from=$_.from;to=$_.to;type=$_.type}})
$result=[pscustomobject]@{schema='codex.powerbi.fabricLineageEvidenceGraph.v1';title='Power BI Fabric Lineage Evidence Graph';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($edges.Count){'EvidenceLinked'}else{'LineageMissing'};evidenceStrength=if($nodes.Count -gt 0 -and $edges.Count -gt 0){'Medium'}else{'Low'};nodeCount=$nodes.Count;edgeCount=$edges.Count;nodes=$nodes;edges=$edges;findings=@()}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
