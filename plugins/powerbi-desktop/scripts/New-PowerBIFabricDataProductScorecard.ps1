param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'executive-war-room'
$owned=@($s.items|Where-Object owner).Count
$labeled=@($s.items|Where-Object sensitivityLabel).Count
$trusted=@($s.items|Where-Object{ $_.trustScore -ge 70 }).Count
$total=[math]::Max(1,$s.items.Count)
$score=[math]::Round((($owned+$labeled+$trusted)/(3*$total))*100,0)
$findings=@(); if($score -lt 80){$findings+=New-FabricFinding Medium DataProduct "Data product score is $score; improve ownership, labels, and trust."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricDataProductScorecard.v1';title='Power BI Fabric Data Product Scorecard';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($score -ge 80){'Strong'}else{'NeedsImprovement'};score=$score;ownedCount=$owned;labeledCount=$labeled;trustedCount=$trusted;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
