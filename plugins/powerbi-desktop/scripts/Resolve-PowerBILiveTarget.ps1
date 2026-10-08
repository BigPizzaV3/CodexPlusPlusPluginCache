param(
    [string]$Server,
    [int]$Port,
    [switch]$RequireSingle,
    [string[]]$WorkspaceRoot,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

function Get-WorkspaceRoots {
    param([string[]]$OverrideRoots)

    if ($OverrideRoots -and $OverrideRoots.Count -gt 0) {
        return @($OverrideRoots | Where-Object { $_ -and (Test-Path -LiteralPath $_) })
    }

    @(
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Power BI Desktop\AnalysisServicesWorkspaces'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Power BI Desktop Store App\AnalysisServicesWorkspaces'),
        (Join-Path $env:USERPROFILE 'Microsoft\Power BI Desktop Store App\AnalysisServicesWorkspaces')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
}

function Get-PortFromWorkspace {
    param([string]$WorkspacePath)

    $portFiles = @(
        (Join-Path $WorkspacePath 'Data\msmdsrv.port.txt'),
        (Join-Path $WorkspacePath 'msmdsrv.port.txt')
    )
    foreach ($portFile in $portFiles) {
        if (Test-Path -LiteralPath $portFile) {
            $raw = (Get-Content -Raw -LiteralPath $portFile)
            $raw = ([regex]::Matches($raw, '\d') | ForEach-Object { $_.Value }) -join ''
            if ($raw -match '^\d+$') {
                return [int]$raw
            }
        }
    }
    return $null
}

function Get-PortFromServer {
    param([string]$Value)

    if (-not $Value) { return $null }
    if ($Value -match ':(?<port>\d+)\s*$') { return [int]$Matches.port }
    return $null
}

function New-LiveTargetCandidate {
    param(
        [string]$Source,
        [string]$Workspace,
        [Nullable[int]]$CandidatePort,
        [Nullable[bool]]$IsListening,
        [Nullable[datetime]]$LastWriteTime,
        [string]$ConnectionString
    )

    [pscustomobject]@{
        source = $Source
        workspace = $Workspace
        port = $CandidatePort
        isListening = $IsListening
        connectionString = $ConnectionString
        lastWriteTime = if ($null -ne $LastWriteTime -and $LastWriteTime.HasValue) { $LastWriteTime.Value.ToString('s') } else { $null }
    }
}

$desktopProcesses = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'PBIDesktop' })
$msmdsrvProcesses = @(Get-CimInstance Win32_Process -Filter "name = 'msmdsrv.exe'" -ErrorAction SilentlyContinue)
$workspacePaths = New-Object System.Collections.Generic.HashSet[string]

foreach ($root in Get-WorkspaceRoots -OverrideRoots $WorkspaceRoot) {
    foreach ($workspace in Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue) {
        [void]$workspacePaths.Add($workspace.FullName)
    }
}

foreach ($process in $msmdsrvProcesses) {
    if ($process.CommandLine -match '-s\s+"(?<path>[^"]+)"') {
        $dataPath = $Matches.path
        $workspacePath = Split-Path -Parent $dataPath
        if ($workspacePath -and (Test-Path -LiteralPath $workspacePath)) {
            [void]$workspacePaths.Add($workspacePath)
        }
    }
}

$candidates = New-Object System.Collections.Generic.List[object]
foreach ($workspacePath in $workspacePaths) {
    $workspace = Get-Item -LiteralPath $workspacePath -ErrorAction SilentlyContinue
    if (-not $workspace) { continue }

    $candidatePort = Get-PortFromWorkspace -WorkspacePath $workspace.FullName
    $isListening = $false
    if ($candidatePort) {
        $isListening = [bool](Get-NetTCPConnection -State Listen -LocalPort $candidatePort -ErrorAction SilentlyContinue)
    }
    $candidates.Add((New-LiveTargetCandidate -Source 'Workspace' -Workspace $workspace.FullName -CandidatePort $candidatePort -IsListening $isListening -LastWriteTime $workspace.LastWriteTime -ConnectionString $(if ($candidatePort) { "Data Source=localhost:$candidatePort" } else { $null })))
}

$explicitServer = $null
if ($Server) {
    $explicitServer = $Server
}
elseif ($Port) {
    $explicitServer = "Data Source=localhost:$Port"
}

$explicitPort = if ($Port) { $Port } else { Get-PortFromServer -Value $explicitServer }
$selected = $null
$status = 'NoLiveTarget'
$reason = 'No listening Power BI Desktop local model endpoint was detected.'

if ($explicitServer) {
    $selected = New-LiveTargetCandidate -Source 'Explicit' -Workspace $null -CandidatePort $explicitPort -IsListening $null -LastWriteTime $null -ConnectionString $explicitServer
    $status = 'TargetResolved'
    $reason = 'Explicit server or port was supplied; no automatic preference was applied.'
}
else {
    $listening = @($candidates | Where-Object { $_.isListening -and $_.port })
    if ($RequireSingle -and $listening.Count -ne 1) {
        $status = if ($listening.Count -gt 1) { 'AmbiguousLiveTarget' } else { 'NoLiveTarget' }
        $reason = "RequireSingle expected exactly one listening endpoint; detected $($listening.Count)."
    }
    elseif ($listening.Count -eq 1) {
        $selected = $listening[0]
        $status = 'TargetResolved'
        $reason = 'Exactly one listening live Desktop endpoint was detected.'
    }
    elseif ($listening.Count -gt 1) {
        $status = 'AmbiguousLiveTarget'
        $reason = 'Multiple listening Desktop endpoints were detected. Supply -Server or -Port to select one.'
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveTargetResolution.v1'
    generated = (Get-Date).ToString('s')
    status = $status
    reason = $reason
    requireSingle = [bool]$RequireSingle
    suppliedServer = $Server
    suppliedPort = if ($Port) { $Port } else { $null }
    powerBIDesktopRunning = $desktopProcesses.Count -gt 0
    powerBIDesktopProcesses = @($desktopProcesses | Select-Object Id, ProcessName, Path, StartTime)
    msmdsrvProcesses = @($msmdsrvProcesses | Select-Object ProcessId, CommandLine)
    target = $selected
    candidates = @($candidates | Sort-Object @{ Expression = { if ($_.isListening) { 0 } else { 1 } } }, @{ Expression = 'lastWriteTime'; Descending = $true })
}

if ($Json) {
    $result | ConvertTo-Json -Depth 10
    return
}

"Status: $($result.status)"
"Reason: $($result.reason)"
if ($result.target) { "Target: $($result.target.connectionString)" }
if ($result.candidates.Count -gt 0) {
    $result.candidates | Format-Table port, isListening, lastWriteTime, workspace -AutoSize
}
