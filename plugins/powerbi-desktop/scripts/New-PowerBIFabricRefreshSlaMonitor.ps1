param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'refresh-failures'
$failed=@($s.refreshHistory|Where-Object status -eq 'Failed')
$slow=@($s.refreshHistory|Where-Object{ $_.durationMinutes -gt 60 })
$findings=@()
if($failed.Count){$findings+=New-FabricFinding High Refresh "$($failed.Count) refresh SLA breaches from failed refreshes."}
if($slow.Count){$findings+=New-FabricFinding Medium Refresh "$($slow.Count) refreshes exceed 60 minutes."}
$result=[pscustomobject]@{schema='codex.powerbi.fabricRefreshSlaMonitor.v1';title='Power BI Fabric Refresh SLA Monitor';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($failed.Count){'SlaBreached'}elseif($slow.Count){'SlaAtRisk'}else{'WithinSla'};breachCount=$failed.Count;atRiskCount=$slow.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
