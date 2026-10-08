param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'refresh-failures'
$hotspots=@($s.capacities|Where-Object{ $_.utilizationPct -ge 80 -or $_.throttlingEvents -gt 0 })
$findings=@($hotspots|ForEach-Object{New-FabricFinding Medium Capacity "$($_.name) utilization $($_.utilizationPct)% with $($_.throttlingEvents) throttling events."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricCapacityHotspotAnalyzer.v1';title='Power BI Fabric Capacity Hotspot Analyzer';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($hotspots.Count){'HotspotsDetected'}else{'NoHotspots'};hotspotCount=$hotspots.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
