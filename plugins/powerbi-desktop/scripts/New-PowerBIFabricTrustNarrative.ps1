param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'executive-war-room'
$avg=if($s.items.Count){[math]::Round((@($s.items|ForEach-Object{[int]$_.trustScore})|Measure-Object -Average).Average,0)}else{0}
$failed=@($s.refreshHistory|Where-Object status -eq 'Failed').Count
$narrative="Fabric trust is $avg across $($s.items.Count) items. Refresh failures: $failed. Release narrative should emphasize certified, labeled, owned, high-usage artifacts and disclose gaps."
$findings=@(); if($avg -lt 70){$findings+=New-FabricFinding High Trust "Average Fabric trust is below 70."}; if($failed){$findings+=New-FabricFinding High Refresh "$failed refresh failures must be disclosed."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricTrustNarrative.v1';title='Power BI Fabric Trust Narrative';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($findings.Count){'NarrativeWithCaveats'}else{'ReadyToShare'};averageTrustScore=$avg;narrative=$narrative;findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
