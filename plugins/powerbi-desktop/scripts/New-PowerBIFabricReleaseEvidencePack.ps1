param([string]$SnapshotDirectory,[string]$OutputDirectory='fabric-release-evidence-pack',[switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut=$ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut|Out-Null
$gate=&(Join-Path $scriptRoot 'Test-PowerBIFabricDeploymentPipelineGate.ps1') -SnapshotDirectory $SnapshotDirectory -OutputPath (Join-Path $resolvedOut 'fabric-deployment-pipeline-gate.json') -Json|ConvertFrom-Json
$cert=&(Join-Path $scriptRoot 'Test-PowerBIFabricCertifiedDatasetReadiness.ps1') -SnapshotDirectory $SnapshotDirectory -OutputPath (Join-Path $resolvedOut 'fabric-certified-dataset-readiness.json') -Json|ConvertFrom-Json
$result=[pscustomobject]@{schema='codex.powerbi.fabricReleaseEvidencePack.v1';generated=(Get-Date).ToString('s');outputDirectory=$resolvedOut;status=if($gate.decision -eq 'BlockPromotion' -or $cert.status -eq 'NotReady'){'Blocked'}elseif($cert.status -eq 'ReadyWithCaveats'){'ReadyWithCaveats'}else{'Ready'};deploymentDecision=$gate.decision;certifiedDatasetStatus=$cert.status;artifactCount=2}
$summary=Join-Path $resolvedOut 'summary.json';$result|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $summary -Encoding UTF8
if($Json){$result|ConvertTo-Json -Depth 6;return}
[pscustomobject]@{OutputDirectory=$resolvedOut;Summary=$summary;Status=$result.status}
