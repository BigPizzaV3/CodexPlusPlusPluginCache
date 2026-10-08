param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'security-exposure'
$external=@($s.items|Where-Object{ $_.sharedExternally -eq $true })
$findings=@($external|ForEach-Object{New-FabricFinding High Sharing "$($_.name) is marked as externally shared."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricSharingExposure.v1';title='Power BI Fabric Sharing Exposure';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($external.Count){'ExposureDetected'}else{'NoExposureDetected'};externalShareCount=$external.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
