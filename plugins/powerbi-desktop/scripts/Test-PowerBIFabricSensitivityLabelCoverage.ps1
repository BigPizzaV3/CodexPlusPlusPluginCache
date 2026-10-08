param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'security-exposure'
$missing=@($s.items|Where-Object{ -not $_.sensitivityLabel })
$findings=@($missing|ForEach-Object{New-FabricFinding High Sensitivity "$($_.name) has no sensitivity label."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricSensitivityLabelCoverage.v1';title='Power BI Fabric Sensitivity Label Coverage';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($missing.Count){'CoverageGap'}else{'Covered'};missingLabelCount=$missing.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
