param(
    [string]$PageName = 'New Page',
    [int]$VisualCount = 4,
    [int]$PageWidth = 1280,
    [int]$PageHeight = 720,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$layout = & (Join-Path $scriptRoot 'New-PowerBIReportLayoutPlan.ps1') -PageName $PageName -VisualCount $VisualCount -PageWidth $PageWidth -PageHeight $PageHeight -Json | ConvertFrom-Json

$fixes = New-Object System.Collections.Generic.List[object]
$i = 0
foreach ($slot in @($layout.slots)) {
    $fixes.Add([pscustomobject]@{
        visualIndex = $i
        action = 'SetBounds'
        x = $slot.x
        y = $slot.y
        width = $slot.width
        height = $slot.height
        reason = 'Align visual to governed responsive grid slot.'
    })
    $i++
}
$fixes.Add([pscustomobject]@{ visualIndex = -1; action = 'NormalizePage'; x = 0; y = 0; width = $PageWidth; height = $PageHeight; reason = 'Keep canvas dimensions stable for Desktop and service rendering.' })

$result = [pscustomobject]@{
    schema = 'codex.powerbi.reportLayoutOptimizer.v1'
    generated = (Get-Date).ToString('s')
    pageName = $PageName
    pageWidth = $PageWidth
    pageHeight = $PageHeight
    fixCount = $fixes.Count
    fixes = $fixes.ToArray()
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @('# Report Layout Optimization', '', "Page: $PageName", '', '## Fixes') + @($fixes | ForEach-Object { "- $($_.action) visual $($_.visualIndex): $($_.reason)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
