param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'security-exposure'
$missing=@($s.items|Where-Object{ $_.type -eq 'SemanticModel' -and $_.rlsEnabled -ne $true })
$findings=@($missing|ForEach-Object{New-FabricFinding High RLS "$($_.name) has no RLS service evidence."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricRlsServiceEvidence.v1';title='Power BI Fabric RLS Service Evidence';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($missing.Count){'RlsEvidenceMissing'}else{'RlsEvidenceAvailable'};missingRlsEvidenceCount=$missing.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
