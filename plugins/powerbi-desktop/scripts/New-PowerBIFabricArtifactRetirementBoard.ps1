param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'portfolio-risk'
$candidates=@($s.items|Where-Object{ ($_.usageScore -eq $null -or $_.usageScore -lt 10) -and ($_.endorsement -ne 'Certified') }|ForEach-Object{[pscustomobject]@{itemId=$_.id;name=$_.name;type=$_.type;usageScore=$_.usageScore;trustScore=$_.trustScore;recommendation='Review for retirement, consolidation, or ownership cleanup.'}})
$result=[pscustomobject]@{schema='codex.powerbi.fabricArtifactRetirementBoard.v1';title='Power BI Fabric Artifact Retirement Board';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($candidates.Count){'ReviewCandidates'}else{'NoRetirementCandidates'};candidateCount=$candidates.Count;candidates=$candidates;findings=@()}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
