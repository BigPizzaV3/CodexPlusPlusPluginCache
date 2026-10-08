param(
    [string]$Path = ".",
    [string]$UsagePath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path).Path
$expectedColumns = @(
    'ReportName',
    'DatasetName',
    'WorkspaceName',
    'UserPrincipalName',
    'Activity',
    'Operation',
    'CreationTime',
    'ViewCount'
)

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    if ([System.IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    $baseUri = [Uri]((Join-Path $BasePath '.') + [System.IO.Path]::DirectorySeparatorChar)
    $targetUri = [Uri]$TargetPath
    [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Get-PropertyValue {
    param([object]$Item, [string[]]$Names)
    foreach ($name in $Names) {
        if ($null -ne $Item.PSObject.Properties[$name]) {
            return $Item.PSObject.Properties[$name].Value
        }
    }
    $null
}

function ConvertTo-Number {
    param([object]$Value)
    if ($null -eq $Value -or "$Value" -eq '') { return 0 }
    $number = 0
    if ([int]::TryParse("$Value", [ref]$number)) { return $number }
    0
}

function Read-UsageFile {
    param([System.IO.FileInfo]$File)
    $extension = $File.Extension.ToLowerInvariant()
    if ($extension -eq '.csv') {
        return @(Import-Csv -LiteralPath $File.FullName)
    }
    if ($extension -eq '.json') {
        $raw = Get-Content -Raw -LiteralPath $File.FullName
        if (-not $raw.Trim()) { return @() }
        $json = $raw | ConvertFrom-Json
        if ($json.value) { return @($json.value) }
        if ($json.records) { return @($json.records) }
        if ($json.activities) { return @($json.activities) }
        if ($json.usage) { return @($json.usage) }
        return @($json)
    }
    @()
}

function New-UsageSignal {
    param([object]$Row, [string]$Source)
    $report = Get-PropertyValue $Row @('ReportName', 'Report', 'ItemName', 'ArtifactName', 'ObjectName')
    $dataset = Get-PropertyValue $Row @('DatasetName', 'SemanticModelName', 'ModelName', 'Dataset')
    $workspace = Get-PropertyValue $Row @('WorkspaceName', 'WorkSpaceName', 'Workspace', 'GroupName')
    $user = Get-PropertyValue $Row @('UserPrincipalName', 'UserId', 'User', 'Actor', 'ActorUserPrincipalName')
    $activity = Get-PropertyValue $Row @('Activity', 'Operation', 'Action', 'EventName', 'RecordType')
    $time = Get-PropertyValue $Row @('CreationTime', 'TimeGenerated', 'Timestamp', 'Date', 'LastActivity')
    $views = ConvertTo-Number (Get-PropertyValue $Row @('ViewCount', 'Views', 'ReportViews', 'Count'))

    [pscustomobject]@{
        reportName = if ($report) { "$report" } else { '[unknown report]' }
        datasetName = if ($dataset) { "$dataset" } else { '[unknown dataset]' }
        workspaceName = if ($workspace) { "$workspace" } else { '[unknown workspace]' }
        userPrincipalName = if ($user) { "$user" } else { '[unknown user]' }
        activity = if ($activity) { "$activity" } else { '[unknown activity]' }
        activityTime = if ($time) { "$time" } else { $null }
        viewCount = $views
        source = $Source
    }
}

$usageFiles = @()
if ($UsagePath) {
    if (Test-Path -LiteralPath $UsagePath -PathType Leaf) {
        $usageFiles = @(Get-Item -LiteralPath $UsagePath)
    }
    elseif (Test-Path -LiteralPath $UsagePath -PathType Container) {
        $usageFiles = @(Get-ChildItem -LiteralPath $UsagePath -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension.ToLowerInvariant() -in @('.csv', '.json') })
    }
}
else {
    $usageFiles = @(Get-ChildItem -LiteralPath $resolved -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Extension.ToLowerInvariant() -in @('.csv', '.json') -and
            $_.Name -match '(?i)usage|activity|audit|view|report.*metric|metrics'
        })
}

$signals = New-Object System.Collections.Generic.List[object]
foreach ($file in $usageFiles) {
    $source = Get-RelativePath -BasePath $resolved -TargetPath $file.FullName
    foreach ($row in @(Read-UsageFile -File $file)) {
        $signals.Add((New-UsageSignal -Row $row -Source $source))
    }
}

$reportUsage = @($signals |
    Group-Object reportName |
    ForEach-Object {
        $rows = @($_.Group)
        [pscustomobject]@{
            reportName = $_.Name
            activityCount = $rows.Count
            viewCount = [int](($rows | Measure-Object -Property viewCount -Sum).Sum)
            distinctUserCount = @($rows | Where-Object { $_.userPrincipalName -ne '[unknown user]' } | Select-Object -ExpandProperty userPrincipalName -Unique).Count
            lastActivity = @($rows | Where-Object activityTime | Sort-Object activityTime -Descending | Select-Object -First 1 -ExpandProperty activityTime)
            sources = @($rows | Select-Object -ExpandProperty source -Unique)
        }
    } | Sort-Object @{ Expression = 'viewCount'; Descending = $true }, @{ Expression = 'activityCount'; Descending = $true })

$status = if ($signals.Count -gt 0) { 'Imported' } else { 'EmptyImport' }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.usageSignals.v1'
    generated = (Get-Date).ToString('s')
    source = $resolved
    usagePath = $UsagePath
    status = $status
    expectedColumns = $expectedColumns
    fileCount = @($usageFiles).Count
    signalCount = $signals.Count
    reportUsage = @($reportUsage)
    signals = @($signals.ToArray())
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Power BI Usage Signals',
    '',
    "Status: $status",
    "Signals: $($signals.Count)",
    "Files: $(@($usageFiles).Count)",
    '',
    '## Expected columns',
    ($expectedColumns -join ', '),
    '',
    '## Report usage'
) + @($reportUsage | ForEach-Object { "- $($_.reportName): activities=$($_.activityCount), views=$($_.viewCount), users=$($_.distinctUserCount)" })

if ($reportUsage.Count -eq 0) {
    $lines += '- No usage export found. Provide Usage Metrics, Activity Events, or audit CSV/JSON exports.'
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
