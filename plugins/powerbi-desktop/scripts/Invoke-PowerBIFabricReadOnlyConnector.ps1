param([string]$SnapshotDirectory,[string]$AccessTokenPath,[string]$WorkspaceId,[string]$WorkspaceName,[string]$OutputDirectory='powerbi-fabric-readonly-connector',[switch]$Json)
$ErrorActionPreference='Stop'; $root=Split-Path -Parent $MyInvocation.MyCommand.Path
$result=& (Join-Path $root 'Import-PowerBIFabricWorkspaceSnapshot.ps1') -SnapshotDirectory $SnapshotDirectory -AccessTokenPath $AccessTokenPath -WorkspaceId $WorkspaceId -WorkspaceName $WorkspaceName -OutputDirectory $OutputDirectory -Json|ConvertFrom-Json
$response=[pscustomobject]@{schema='codex.powerbi.fabricReadOnlyConnector.v1';status=$result.status;mode=$result.mode;outputDirectory=$result.OutputDirectory;readOnly=$true;writesBlocked=$true;nextAction='Use the imported snapshot as evidence; mutating Fabric methods remain blocked.'}
if($Json){$response|ConvertTo-Json -Depth 8}else{$response}
