param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'refresh-failures'
$events=@()
$events+=@($s.refreshHistory|Where-Object status -eq 'Failed'|ForEach-Object{[pscustomobject]@{time=$_.startTime;type='RefreshFailure';itemId=$_.itemId;detail=$_.error}})
$events+=@($s.gateways|Where-Object{ $_.status -ne 'Online'}|ForEach-Object{[pscustomobject]@{time=$null;type='GatewayRisk';itemId=$_.id;detail="$($_.name) is $($_.status)"}})
$result=[pscustomobject]@{schema='codex.powerbi.fabricIncidentTimeline.v1';title='Power BI Fabric Incident Timeline';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($events.Count){'IncidentsDetected'}else{'NoIncidents'};eventCount=$events.Count;events=$events;findings=@()}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
