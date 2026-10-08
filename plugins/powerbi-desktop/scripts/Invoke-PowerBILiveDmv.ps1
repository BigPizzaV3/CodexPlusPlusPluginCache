param(
    [string]$Server,
    [string]$Query = 'SELECT * FROM $SYSTEM.DBSCHEMA_CATALOGS',
    [string]$AdomdClientPath,
    [switch]$NoFallback,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSEdition -eq 'Core' -and -not $NoFallback) {
    $argsList = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $PSCommandPath
    )
    if ($Server) { $argsList += @('-Server', $Server) }
    if ($Query) { $argsList += @('-Query', $Query) }
    if ($AdomdClientPath) { $argsList += @('-AdomdClientPath', $AdomdClientPath) }
    if ($Json) { $argsList += '-Json' }
    $argsList += '-NoFallback'
    & powershell.exe @argsList
    exit $LASTEXITCODE
}

function Find-AdomdClient {
    $candidates = @(
        'C:\Program Files\Microsoft.NET\ADOMD.NET\170\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files\DAX Studio\bin\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files\Microsoft SQL Server Management Studio 22\Release\Common7\IDE\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files\Microsoft SQL Server Management Studio 21\Release\Common7\IDE\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files (x86)\Microsoft.NET\ADOMD.NET\170\Microsoft.AnalysisServices.AdomdClient.dll'
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }
    return $null
}

if (-not $Server) {
    $liveScript = Join-Path $PSScriptRoot 'Get-PowerBIDesktopLiveConnection.ps1'
    $live = & $liveScript -Json | ConvertFrom-Json
    if ($live.preferredConnection -and $live.preferredConnection.ConnectionString) {
        $Server = $live.preferredConnection.ConnectionString
    }
}

if (-not $Server) {
    throw 'No live Power BI Desktop server found. Open a PBIX/PBIP in Power BI Desktop first, then retry.'
}

if (-not $AdomdClientPath) {
    $AdomdClientPath = Find-AdomdClient
}
if (-not $AdomdClientPath) {
    throw 'Microsoft.AnalysisServices.AdomdClient.dll was not found. Install DAX Studio, SSMS, Tabular Editor, or ADOMD.NET.'
}

Add-Type -Path $AdomdClientPath

$connection = [Microsoft.AnalysisServices.AdomdClient.AdomdConnection]::new($Server)
$rows = New-Object System.Collections.Generic.List[object]
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    $command.CommandText = $Query
    $reader = $command.ExecuteReader()
    try {
        while ($reader.Read()) {
            $row = [ordered]@{}
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                $value = $reader.GetValue($i)
                if ($value -is [DBNull]) { $value = $null }
                $row[$reader.GetName($i)] = $value
            }
            $rows.Add([pscustomobject]$row)
        }
    }
    finally {
        $reader.Close()
    }
}
finally {
    $connection.Close()
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveDmv.v1'
    server = $Server
    query = $Query
    adomdClientPath = $AdomdClientPath
    rowCount = $rows.Count
    rows = @($rows.ToArray())
}

if ($Json) {
    $result | ConvertTo-Json -Depth 8
    return
}

$rows | Format-Table -AutoSize
