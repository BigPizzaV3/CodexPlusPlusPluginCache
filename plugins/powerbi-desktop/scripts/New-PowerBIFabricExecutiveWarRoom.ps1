param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'executive-war-room'
$failed=@($s.refreshHistory|Where-Object status -eq 'Failed').Count
$lowTrust=@($s.items|Where-Object{ $_.trustScore -lt 70 }).Count
$highUse=@($s.items|Where-Object{ $_.usageScore -ge 90 }).Count
$findings=@()
if($failed){$findings+=New-FabricFinding High Refresh "$failed executive workspace refresh failures detected."}
if($lowTrust){$findings+=New-FabricFinding High Trust "$lowTrust high-visibility items are below trust threshold."}
$markdown=("# Power BI Fabric Executive War Room", "", "Decision: **$(if($findings.Count){'Action Required'}else{'Monitor'})**", "", "- High usage items: $highUse", "- Findings: $($findings.Count)") -join [Environment]::NewLine
$result=[pscustomobject]@{schema='codex.powerbi.fabricExecutiveWarRoom.v1';title='Power BI Fabric Executive War Room';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($findings.Count){'ActionRequired'}else{'Monitor'};highUsageItemCount=$highUse;findingCount=$findings.Count;findings=$findings;markdown=$markdown}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
