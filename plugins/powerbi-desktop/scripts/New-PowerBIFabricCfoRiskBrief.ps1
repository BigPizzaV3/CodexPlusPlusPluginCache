param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'executive-war-room'
$financial=@($s.items|Where-Object{ $_.name -match '(?i)sales|revenue|margin|finance|kpi' })
$lowTrust=@($financial|Where-Object{ $_.trustScore -lt 80 })
$findings=@($lowTrust|ForEach-Object{New-FabricFinding High Finance "$($_.name) is CFO-relevant and below trust target."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricCfoRiskBrief.v1';title='Power BI Fabric CFO Risk Brief';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($lowTrust.Count){'CfoRisk'}else{'CfoReady'};financialItemCount=$financial.Count;findingCount=$findings.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
