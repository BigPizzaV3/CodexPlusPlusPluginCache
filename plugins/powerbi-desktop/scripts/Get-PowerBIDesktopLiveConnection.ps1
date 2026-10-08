param(
    [string]$Server,
    [int]$Port,
    [switch]$RequireSingle,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$resolutionArgs = @{}
if ($Server) { $resolutionArgs.Server = $Server }
if ($Port) { $resolutionArgs.Port = $Port }
if ($RequireSingle) { $resolutionArgs.RequireSingle = $true }
$resolution = & (Join-Path $PSScriptRoot 'Resolve-PowerBILiveTarget.ps1') @resolutionArgs -Json | ConvertFrom-Json
$workspaces = @($resolution.candidates | ForEach-Object {
    [pscustomobject]@{
        Workspace = $_.workspace
        Port = $_.port
        IsListening = $_.isListening
        ConnectionString = $_.connectionString
        LastWriteTime = $_.lastWriteTime
    }
})

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveConnection.v1'
    generated = (Get-Date).ToString('s')
    status = $resolution.status
    reason = $resolution.reason
    requireSingle = $resolution.requireSingle
    suppliedServer = $resolution.suppliedServer
    suppliedPort = $resolution.suppliedPort
    powerBIDesktopRunning = $resolution.powerBIDesktopRunning
    powerBIDesktopProcesses = @($resolution.powerBIDesktopProcesses)
    msmdsrvProcesses = @($resolution.msmdsrvProcesses)
    workspaces = @($workspaces)
    preferredConnection = if ($resolution.status -eq 'TargetResolved') { $resolution.target } else { $null }
    target = $resolution.target
    targetCandidates = @($resolution.candidates)
}

if ($Json) {
    $result | ConvertTo-Json -Depth 8
    return
}

"Power BI Desktop running: $($result.powerBIDesktopRunning)"
"Status: $($result.status)"
if ($result.preferredConnection) {
    "Selected connection: $($result.preferredConnection.connectionString)"
    if ($result.preferredConnection.workspace) { "Workspace: $($result.preferredConnection.workspace)" }
}
elseif ($result.status -eq 'AmbiguousLiveTarget') {
    'Multiple live Power BI Desktop endpoints were detected. Rerun with -Server or -Port.'
}
elseif ($result.workspaces.Count -gt 0) {
    'Workspace folders found, but no listening local model port was detected.'
}
else {
    'No live Power BI Desktop Analysis Services workspace was detected.'
}

if ($result.workspaces.Count -gt 0) {
    $result.workspaces | Format-Table Port, IsListening, LastWriteTime, Workspace -AutoSize
}
