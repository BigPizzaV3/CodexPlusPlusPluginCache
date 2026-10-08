param(
    [string]$Path = ".",
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Path).Path
$patterns = @('*.pbix', '*.pbit', '*.pbip', '*.pbism', '*.bim', '*.tmdl', '*.dax', '*.pq')

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    if ([System.IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    $baseUri = [Uri]((Join-Path $BasePath '.') + [System.IO.Path]::DirectorySeparatorChar)
    $targetUri = [Uri]$TargetPath
    [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

$files = foreach ($pattern in $patterns) {
    Get-ChildItem -LiteralPath $root -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
}

$items = $files |
    Sort-Object FullName -Unique |
    ForEach-Object {
        [pscustomobject]@{
            Type = $_.Extension.TrimStart('.').ToUpperInvariant()
            Name = $_.Name
            FullName = $_.FullName
            RelativePath = Get-RelativePath -BasePath $root -TargetPath $_.FullName
            SizeKB = [math]::Round($_.Length / 1KB, 1)
            LastWriteTime = $_.LastWriteTime
            EditableText = $_.Extension -in @('.pbip', '.pbism', '.bim', '.tmdl', '.dax', '.pq')
        }
    }

if ($Json) {
    $items | ConvertTo-Json -Depth 4
    return
}

if (-not $items) {
    "No Power BI Desktop files found under $root"
    return
}

$items | Format-Table Type, RelativePath, SizeKB, LastWriteTime, EditableText -AutoSize
