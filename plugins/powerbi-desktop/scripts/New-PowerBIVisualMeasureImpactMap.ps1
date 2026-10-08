param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    if ([System.IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    $baseUri = [Uri]((Join-Path $BasePath '.') + [System.IO.Path]::DirectorySeparatorChar)
    $targetUri = [Uri]$TargetPath
    [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Get-JsonFiles {
    param([string]$Root)
    Get-ChildItem -LiteralPath $Root -Recurse -File -Include *.json -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '(?i)(Report|report|definition|pages|visual)' } |
        Sort-Object FullName
}

function Get-VisualRecords {
    param([string]$Root)
    foreach ($file in Get-JsonFiles -Root $Root) {
        $relative = Get-RelativePath -BasePath $Root -TargetPath $file.FullName
        $text = Get-Content -Raw -LiteralPath $file.FullName
        $json = $null
        try { $json = $text | ConvertFrom-Json -ErrorAction Stop } catch { $json = $null }
        $visualType = $null
        $visualName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        if ($json) {
            if ($json.visualType) { $visualType = [string]$json.visualType }
            elseif ($json.singleVisual.visualType) { $visualType = [string]$json.singleVisual.visualType }
            elseif ($json.config) {
                try {
                    $config = $json.config | ConvertFrom-Json -ErrorAction Stop
                    if ($config.singleVisual.visualType) { $visualType = [string]$config.singleVisual.visualType }
                    if ($config.name) { $visualName = [string]$config.name }
                }
                catch {}
            }
            if ($json.name) { $visualName = [string]$json.name }
        }
        [pscustomobject]@{
            name = $visualName
            visualType = if ($visualType) { $visualType } else { 'Unknown' }
            source = $relative
            text = $text
        }
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$resolved = (Resolve-Path -LiteralPath $Path).Path
$visualRecords = @(Get-VisualRecords -Root $resolved)
$reportText = ($visualRecords | ForEach-Object { $_.text }) -join [Environment]::NewLine
$items = foreach ($metric in @($catalog.metrics)) {
    $hits = if ($reportText) { ([regex]::Matches($reportText, [regex]::Escape($metric.name))).Count } else { 0 }
    $affected = @($visualRecords | Where-Object { $_.text -match [regex]::Escape($metric.name) } | ForEach-Object {
        [pscustomobject]@{ visual = $_.name; visualType = $_.visualType; source = $_.source }
    })
    [pscustomobject]@{
        measure = $metric.name
        table = $metric.table
        detectedVisualReferences = $hits
        affectedVisuals = @($affected)
        affectedPages = $(if ($hits -gt 0) { @($affected | Select-Object -ExpandProperty source -Unique) } else { @() })
        lineageConfidence = if ($hits -gt 0) { 'MetadataMatch' } else { 'NotDetected' }
        impactGuidance = $(if ($hits -gt 0) { 'Validate affected visuals, tooltips, drillthrough paths, and filter interactions before publishing.' } else { 'No visual metadata reference detected; validate manually or export PBIP report metadata.' })
    }
}
$result = [pscustomobject]@{
    schema = 'codex.powerbi.visualMeasureImpactMap.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    reportMetadataStatus = if ($visualRecords.Count -gt 0) { 'Available' } else { 'NotAvailable' }
    visualCount = $visualRecords.Count
    measureCount = @($items).Count
    impacts = @($items)
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Visual-to-Measure Impact Map', '') + @($result.impacts | ForEach-Object { "- `$($_.measure)`: $($_.detectedVisualReferences) visual metadata references. $($_.impactGuidance)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
