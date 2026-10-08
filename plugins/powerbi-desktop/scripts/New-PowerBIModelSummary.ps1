param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$PassThru
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Path).Path
$textExtensions = @('.tmdl', '.dax', '.pq', '.bim', '.pbism', '.json')

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    if ([System.IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    $baseUri = [Uri]((Join-Path $BasePath '.') + [System.IO.Path]::DirectorySeparatorChar)
    $targetUri = [Uri]$TargetPath
    [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Read-TextFile {
    param([string]$FilePath)
    Get-Content -Raw -LiteralPath $FilePath
}

function Get-DaxMeasures {
    param([string]$Text, [string]$RelativePath)

    $pattern = '(?ms)^\s*(?:MEASURE\s+)?(?:(?<table>''[^'']+''|\w+)\s*)?\[(?<name>[^\]\r\n=]+)\]\s*=\s*(?<expr>.*?)(?=^\s*(?:MEASURE\s+)?(?:(?:''[^'']+''|\w+)\s*)?\[[^\]\r\n=]+\]\s*=|\z)'
    foreach ($match in [regex]::Matches($Text, $pattern)) {
        $name = ($match.Groups['name'].Value).Trim()
        $expr = ($match.Groups['expr'].Value).Trim()
        if ($name -and $expr) {
            [pscustomobject]@{
                Name = $name
                Table = ($match.Groups['table'].Value).Trim()
                Expression = $expr
                Source = $RelativePath
            }
        }
    }
}

function Get-PowerQueryNames {
    param([string]$Text, [string]$RelativePath)

    $name = [System.IO.Path]::GetFileNameWithoutExtension($RelativePath)
    if ($Text -match '(?m)^\s*let\s*$') {
        [pscustomobject]@{
            Name = $name
            Source = $RelativePath
            HasLetExpression = $true
        }
    }
}

function Get-TmdlObjects {
    param([string]$Text, [string]$RelativePath)

    foreach ($match in [regex]::Matches($Text, '(?m)^\s*(table|column|measure|relationship|partition|calculationGroup)\s+(.+?)\s*$')) {
        [pscustomobject]@{
            Kind = $match.Groups[1].Value
            Name = $match.Groups[2].Value.Trim()
            Source = $RelativePath
        }
    }
}

function Get-ModelBimSummary {
    param([string]$Text, [string]$RelativePath)

    try {
        $json = $Text | ConvertFrom-Json
    }
    catch {
        return $null
    }

    $model = if ($json.model) { $json.model } elseif ($json.compatibilityLevel) { $json } else { $null }
    if (-not $model) {
        return $null
    }

    $tables = @($model.tables)
    $relationships = @($model.relationships)
    [pscustomobject]@{
        Source = $RelativePath
        CompatibilityLevel = $model.compatibilityLevel
        TableCount = $tables.Count
        RelationshipCount = $relationships.Count
        Tables = $tables | ForEach-Object {
            [pscustomobject]@{
                Name = $_.name
                ColumnCount = @($_.columns).Count
                MeasureCount = @($_.measures).Count
                PartitionCount = @($_.partitions).Count
            }
        }
    }
}

$files = Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName

$daxMeasures = New-Object System.Collections.Generic.List[object]
$powerQueries = New-Object System.Collections.Generic.List[object]
$tmdlObjects = New-Object System.Collections.Generic.List[object]
$bimSummaries = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
    $relative = Get-RelativePath -BasePath $root -TargetPath $file.FullName
    $text = Read-TextFile -FilePath $file.FullName

    if ($file.Extension -in @('.dax', '.tmdl')) {
        Get-DaxMeasures -Text $text -RelativePath $relative | ForEach-Object { $daxMeasures.Add($_) }
    }

    if ($file.Extension -eq '.pq') {
        Get-PowerQueryNames -Text $text -RelativePath $relative | ForEach-Object { $powerQueries.Add($_) }
    }

    if ($file.Extension -eq '.tmdl') {
        Get-TmdlObjects -Text $text -RelativePath $relative | ForEach-Object { $tmdlObjects.Add($_) }
    }

    if ($file.Extension -eq '.bim') {
        $summary = Get-ModelBimSummary -Text $text -RelativePath $relative
        if ($summary) {
            $bimSummaries.Add($summary)
        }
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Model Summary')
$lines.Add('')
$lines.Add(('Root: `{0}`' -f $root))
$lines.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add('')
$lines.Add('## Files')
$lines.Add('')
if ($files) {
    foreach ($file in $files) {
        $relative = Get-RelativePath -BasePath $root -TargetPath $file.FullName
        $lines.Add(('- `{0}`' -f $relative))
    }
}
else {
    $lines.Add('No text-based Power BI model files found.')
}

$lines.Add('')
$lines.Add('## TMDL Objects')
$lines.Add('')
if ($tmdlObjects.Count -gt 0) {
    foreach ($group in $tmdlObjects | Group-Object Kind) {
        $lines.Add("### $($group.Name)")
        foreach ($item in $group.Group) {
            $lines.Add(('- `{0}` from `{1}`' -f $item.Name, $item.Source))
        }
        $lines.Add('')
    }
}
else {
    $lines.Add('No TMDL object declarations found.')
}

$lines.Add('')
$lines.Add('## DAX Measures')
$lines.Add('')
if ($daxMeasures.Count -gt 0) {
    foreach ($measure in $daxMeasures) {
        $displayName = if ($measure.Table) { "$($measure.Table)[$($measure.Name)]" } else { $measure.Name }
        $lines.Add("### $displayName")
        $lines.Add('')
        $lines.Add(('Source: `{0}`' -f $measure.Source))
        $lines.Add('')
        $lines.Add('```DAX')
        $lines.Add($measure.Expression)
        $lines.Add('```')
        $lines.Add('')
    }
}
else {
    $lines.Add('No DAX measures found.')
}

$lines.Add('')
$lines.Add('## Power Query')
$lines.Add('')
if ($powerQueries.Count -gt 0) {
    foreach ($query in $powerQueries) {
        $lines.Add(('- `{0}` from `{1}`' -f $query.Name, $query.Source))
    }
}
else {
    $lines.Add('No Power Query files found.')
}

$lines.Add('')
$lines.Add('## model.bim')
$lines.Add('')
if ($bimSummaries.Count -gt 0) {
    foreach ($summary in $bimSummaries) {
        $lines.Add(('### `{0}`' -f $summary.Source))
        $lines.Add('')
        $lines.Add("- Compatibility level: $($summary.CompatibilityLevel)")
        $lines.Add("- Tables: $($summary.TableCount)")
        $lines.Add("- Relationships: $($summary.RelationshipCount)")
        foreach ($table in $summary.Tables) {
            $lines.Add(('- `{0}`: {1} columns, {2} measures, {3} partitions' -f $table.Name, $table.ColumnCount, $table.MeasureCount, $table.PartitionCount))
        }
        $lines.Add('')
    }
}
else {
    $lines.Add('No parseable model.bim files found.')
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine

if ($OutputPath) {
    $resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
    Set-Content -LiteralPath $resolvedOutput -Value $content -Encoding UTF8
}

if ($PassThru -or -not $OutputPath) {
    $content
}
