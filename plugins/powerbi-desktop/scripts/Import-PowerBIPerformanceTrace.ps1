param(
    [string]$Path = ".",
    [string]$TracePath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$hotspots = New-Object System.Collections.Generic.List[object]

if ($TracePath -and (Test-Path -LiteralPath $TracePath)) {
    $text = Get-Content -Raw -LiteralPath $TracePath
    foreach ($match in [regex]::Matches($text, '(?im)(?<name>[A-Za-z0-9 _%.-]+).{0,80}?(?<ms>\d{3,})\s*ms')) {
        $hotspots.Add([pscustomobject]@{
            name = $match.Groups['name'].Value.Trim()
            durationMs = [int]$match.Groups['ms'].Value
            source = $TracePath
            recommendation = 'Inspect DAX query plan, storage engine calls, and visual filter context.'
        })
    }
}

if ($hotspots.Count -eq 0) {
    foreach ($metric in @($catalog.metrics | Where-Object { @($_.risks).Count -gt 0 })) {
        $hotspots.Add([pscustomobject]@{
            name = $metric.name
            durationMs = $null
            source = 'Heuristic'
            recommendation = 'No trace file supplied; prioritize DAX risk pattern review for this measure.'
        })
    }
}

if ($hotspots.Count -eq 0 -and @($catalog.metrics).Count -gt 0) {
    $metric = @($catalog.metrics)[0]
    $hotspots.Add([pscustomobject]@{
        name = $metric.name
        durationMs = $null
        source = 'Baseline'
        recommendation = 'Capture Performance Analyzer or DAX Studio trace to replace baseline hotspot.'
    })
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.performanceTraceImport.v1'
    generated = (Get-Date).ToString('s')
    tracePath = $TracePath
    hotspotCount = $hotspots.Count
    hotspots = $hotspots.ToArray()
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @('# Power BI Performance Trace Import', '', "Hotspots: $($hotspots.Count)", '', '## Hotspots') + @($hotspots | ForEach-Object { "- $($_.name): $($_.recommendation)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
