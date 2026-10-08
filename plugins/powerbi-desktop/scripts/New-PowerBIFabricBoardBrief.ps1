param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'executive-war-room'
$certified=@($s.items|Where-Object endorsement -eq 'Certified').Count
$unlabeled=@($s.items|Where-Object{ -not $_.sensitivityLabel }).Count
$findings=@(); if($unlabeled){$findings+=New-FabricFinding High Sensitivity "$unlabeled board-facing items miss labels."}
$markdown=("# Power BI Fabric Board Brief","","Certified items: $certified","Unlabeled items: $unlabeled") -join [Environment]::NewLine
$result=[pscustomobject]@{schema='codex.powerbi.fabricBoardBrief.v1';title='Power BI Fabric Board Brief';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($findings.Count){'NeedsReview'}else{'Ready'};certifiedItemCount=$certified;findingCount=$findings.Count;findings=$findings;markdown=$markdown}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
