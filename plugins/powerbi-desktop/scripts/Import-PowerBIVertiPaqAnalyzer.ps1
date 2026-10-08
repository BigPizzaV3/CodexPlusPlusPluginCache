param(
    [string]$Path = ".",
    [string]$VpaxPath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path).Path
$columns = New-Object System.Collections.Generic.List[object]

if ($VpaxPath -and (Test-Path -LiteralPath $VpaxPath)) {
    $text = Get-Content -Raw -LiteralPath $VpaxPath
    foreach ($match in [regex]::Matches($text, '(?im)(?<table>[A-Za-z0-9 _-]+)\[(?<column>[A-Za-z0-9 _-]+)\].{0,80}?(?<size>\d+)')) {
        $size = [int64]$match.Groups['size'].Value
        $columns.Add([pscustomobject]@{
            table = $match.Groups['table'].Value.Trim()
            column = $match.Groups['column'].Value.Trim()
            estimatedSize = $size
            risk = if ($size -gt 1000000) { 'High' } elseif ($size -gt 100000) { 'Medium' } else { 'Low' }
            recommendation = 'Validate cardinality, encoding, and whether the column is needed in import mode.'
        })
    }
}

if ($columns.Count -eq 0) {
    $files = Get-ChildItem -LiteralPath $resolved -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension.ToLowerInvariant() -in @('.tmdl', '.bim', '.json') } |
        Select-Object -First 20
    foreach ($file in $files) {
        $text = Get-Content -Raw -LiteralPath $file.FullName
        foreach ($match in [regex]::Matches($text, '(?im)^\s*column\s+(.+?)\s*$')) {
            $columns.Add([pscustomobject]@{
                table = '[unknown]'
                column = $match.Groups[1].Value.Trim()
                estimatedSize = $null
                risk = 'Unknown'
                recommendation = 'No VPAX supplied; capture VertiPaq Analyzer export for true size and cardinality.'
            })
        }
    }
}

if ($columns.Count -eq 0) {
    $columns.Add([pscustomobject]@{ table = '[unknown]'; column = '[capture required]'; estimatedSize = $null; risk = 'Unknown'; recommendation = 'Provide VPAX export or TMDL columns for storage-risk analysis.' })
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.vertipaqImport.v1'
    generated = (Get-Date).ToString('s')
    source = $resolved
    vpaxPath = $VpaxPath
    columnCount = $columns.Count
    columns = $columns.ToArray()
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @('# VertiPaq Analyzer Import', '', "Columns: $($columns.Count)", '', '## Columns') + @($columns | ForEach-Object { "- $($_.table)[$($_.column)] Risk=$($_.risk): $($_.recommendation)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
