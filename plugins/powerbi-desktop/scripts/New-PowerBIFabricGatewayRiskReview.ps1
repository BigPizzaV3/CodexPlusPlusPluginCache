param([string]$SnapshotDirectory,[string]$OutputPath,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s=Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'refresh-failures'
$risky=@($s.gateways|Where-Object{ $_.status -ne 'Online' -or -not $_.owner })
$findings=@($risky|ForEach-Object{New-FabricFinding High Gateway "$($_.name) status=$($_.status), owner=$($_.owner)."})
$result=[pscustomobject]@{schema='codex.powerbi.fabricGatewayRiskReview.v1';title='Power BI Fabric Gateway Risk Review';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($risky.Count){'GatewayRisk'}else{'Passed'};riskyGatewayCount=$risky.Count;findings=$findings}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
