param([string]$Path='.', [string]$OutputDirectory='powerbi-live-validation-evidence', [string]$Server, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$out=$ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out|Out-Null
$connection=& (Join-Path $scriptRoot 'Get-PowerBIDesktopLiveConnection.ps1') -Server $Server -Json|ConvertFrom-Json
$summaryPath=Join-Path $out 'summary.json'
$records=New-Object System.Collections.Generic.List[object]
foreach($artifact in @('live-connection.json','live-measure-validation.json','live-insight-scan.json','live-metric-catalog.json')){
 $candidate=Join-Path $root $artifact
 if(Test-Path -LiteralPath $candidate){$records.Add([pscustomobject]@{artifact=$artifact;evidenceState='Observed';path=$candidate})}
}
$records.Add([pscustomobject]@{artifact='live-endpoint';evidenceState=if($connection.status -eq 'TargetResolved'){'Observed'}else{'Unavailable'};path=$connection.target.connectionString})
$result=[pscustomobject]@{schema='codex.powerbi.liveValidationEvidenceRecorder.v1';generated=(Get-Date).ToString('s');source=$root;outputDirectory=$out;liveStatus=$connection.status;evidenceCount=$records.Count;evidence=@($records.ToArray())}
$result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $summaryPath -Encoding UTF8
if($Json){$result|ConvertTo-Json -Depth 8;return}
$result
