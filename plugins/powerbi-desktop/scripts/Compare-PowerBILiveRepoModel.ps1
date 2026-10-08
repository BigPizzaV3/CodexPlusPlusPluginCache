param(
    [string]$Path = ".",
    [string]$Server,
    [int]$Port,
    [switch]$RequireSingle,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Normalize-Expression {
    param([string]$Expression)
    if ($null -eq $Expression) { return '' }
    return (($Expression -replace '\s+', ' ').Trim())
}

function Get-MeasureKey {
    param($Measure)
    $table = if ($Measure.table) { [string]$Measure.table } else { '' }
    $name = if ($Measure.name) { [string]$Measure.name } else { '' }
    return ("$table|$name").ToLowerInvariant()
}

function Get-RepoTables {
    param([string]$RootPath, $Catalog)

    $names = New-Object System.Collections.Generic.HashSet[string]
    foreach ($metric in @($Catalog.metrics)) {
        if ($metric.table) { [void]$names.Add([string]$metric.table) }
    }

    $files = Get-ChildItem -LiteralPath $RootPath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension.ToLowerInvariant() -in @('.tmdl', '.pq') }
    foreach ($file in $files) {
        $text = Get-Content -Raw -LiteralPath $file.FullName
        if ($file.Extension.ToLowerInvariant() -eq '.tmdl') {
            foreach ($match in [regex]::Matches($text, '(?m)^\s*table\s+(''(?<quoted>[^'']+)''|(?<plain>[^\r\n]+?))\s*$')) {
                $name = if ($match.Groups['quoted'].Success) { $match.Groups['quoted'].Value } else { $match.Groups['plain'].Value.Trim() }
                if ($name) { [void]$names.Add($name) }
            }
        }
        elseif ($file.Extension.ToLowerInvariant() -eq '.pq') {
            [void]$names.Add([System.IO.Path]::GetFileNameWithoutExtension($file.Name))
        }
    }

    @($names | ForEach-Object { [pscustomobject]@{ name = $_; source = 'repo' } })
}

$repo = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$repoRoot = (Resolve-Path -LiteralPath $Path).Path
$repoTables = @(Get-RepoTables -RootPath $repoRoot -Catalog $repo)
$live = $null
$liveSummary = $null
$liveStatus = 'LiveUnavailable'
$liveDetail = ''
$resolvedServer = $Server
try {
    if (-not $resolvedServer) {
        $targetArgs = @{}
        if ($Port) { $targetArgs.Port = $Port }
        if ($RequireSingle) { $targetArgs.RequireSingle = $true }
        $target = & (Join-Path $scriptRoot 'Resolve-PowerBILiveTarget.ps1') @targetArgs -Json | ConvertFrom-Json
        if ($target.status -ne 'TargetResolved' -or -not $target.target.connectionString) {
            throw $target.reason
        }
        $resolvedServer = $target.target.connectionString
    }
    $live = & (Join-Path $scriptRoot 'New-PowerBILiveMetricCatalog.ps1') -Server $resolvedServer -Json | ConvertFrom-Json
    $liveSummary = & (Join-Path $scriptRoot 'Get-PowerBILiveModelSummary.ps1') -Server $resolvedServer -Json | ConvertFrom-Json
}
catch {
    $liveDetail = $_.Exception.Message
}

$differences = New-Object System.Collections.Generic.List[object]
if ($live) {
    $repoByName = @{}
    foreach ($m in @($repo.metrics)) { $repoByName[(Get-MeasureKey -Measure $m)] = $m }
    $liveByName = @{}
    foreach ($m in @($live.metrics)) { $liveByName[(Get-MeasureKey -Measure $m)] = $m }
    foreach ($name in $repoByName.Keys) {
        $repoMeasure = $repoByName[$name]
        if (-not $liveByName.ContainsKey($name)) { $differences.Add([pscustomobject]@{ type = 'RepoOnlyMeasure'; objectType = 'Measure'; table = $repoMeasure.table; measure = $repoMeasure.name; risk = 'Medium'; detail = 'Measure exists in repo but not live Desktop model.' }) }
        elseif ((Normalize-Expression $repoMeasure.expression) -ne (Normalize-Expression $liveByName[$name].expression)) { $differences.Add([pscustomobject]@{ type = 'ExpressionDrift'; objectType = 'Measure'; table = $repoMeasure.table; measure = $repoMeasure.name; risk = 'High'; detail = 'Measure expression differs between repo and live Desktop model.' }) }
    }
    foreach ($name in $liveByName.Keys) {
        $liveMeasure = $liveByName[$name]
        if (-not $repoByName.ContainsKey($name)) { $differences.Add([pscustomobject]@{ type = 'LiveOnlyMeasure'; objectType = 'Measure'; table = $liveMeasure.table; measure = $liveMeasure.name; risk = 'High'; detail = 'Measure exists live but is not represented in repo/source control.' }) }
    }

    if ($liveSummary) {
        $repoTableByName = @{}
        foreach ($table in @($repoTables)) { if ($table.name) { $repoTableByName[[string]$table.name] = $table } }
        $liveTableByName = @{}
        foreach ($table in @($liveSummary.tables)) { if ($table.Name) { $liveTableByName[[string]$table.Name] = $table } }
        foreach ($name in $repoTableByName.Keys) {
            if (-not $liveTableByName.ContainsKey($name)) { $differences.Add([pscustomobject]@{ type = 'RepoOnlyTable'; objectType = 'Table'; table = $name; measure = $null; risk = 'Medium'; detail = 'Table appears in repo artifacts but not live Desktop model.' }) }
        }
        foreach ($name in $liveTableByName.Keys) {
            if (-not $repoTableByName.ContainsKey($name)) { $differences.Add([pscustomobject]@{ type = 'LiveOnlyTable'; objectType = 'Table'; table = $name; measure = $null; risk = 'Medium'; detail = 'Table exists live but is not represented in repo artifacts detected by the plugin.' }) }
        }
    }

    $liveStatus = if ($differences.Count -gt 0) { 'DriftDetected' } else { 'NoDrift' }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveRepoReconciliation.v1'
    generated = (Get-Date).ToString('s')
    repoPath = $repoRoot
    server = $resolvedServer
    liveStatus = $liveStatus
    liveDetail = $liveDetail
    repoMeasureCount = $repo.metricCount
    repoTableCount = $repoTables.Count
    liveMeasureCount = if ($live) { $live.metricCount } else { $null }
    liveTableCount = if ($liveSummary) { $liveSummary.tableCount } else { $null }
    differenceCount = $differences.Count
    differences = @($differences.ToArray())
    statusMeaning = [pscustomobject]@{
        LiveUnavailable = 'No live comparison was performed because Desktop endpoint or ADOMD access was unavailable.'
        NoDrift = 'Live endpoint was available and no supported measure/table drift was detected.'
        DriftDetected = 'Live endpoint was available and supported measure/table drift was detected.'
    }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = @(
    '# Power BI Live vs Repo Reconciliation',
    '',
    "Live status: $($result.liveStatus)",
    "Live detail: $($result.liveDetail)",
    "Repo measures: $($result.repoMeasureCount)",
    "Live measures: $($result.liveMeasureCount)",
    "Repo tables: $($result.repoTableCount)",
    "Live tables: $($result.liveTableCount)",
    "Differences: $($result.differenceCount)",
    ''
) + @($result.differences | ForEach-Object {
    $objectName = if ($_.objectType -eq 'Measure') { "$($_.table)[$($_.measure)]" } else { $_.table }
    "- [$($_.risk)] $($_.type): `$objectName` - $($_.detail)"
})
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
