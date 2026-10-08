param(
    [string]$PageName = 'New Page',
    [string[]]$Measures = @(),
    [string]$OutputPath,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$visualCount = [math]::Max(1, $Measures.Count)
$layout = & (Join-Path $scriptRoot 'New-PowerBIReportLayoutPlan.ps1') -PageName $PageName -VisualCount $visualCount -Json | ConvertFrom-Json
$visuals = New-Object System.Collections.Generic.List[object]
for ($i = 0; $i -lt $visualCount; $i++) {
    $measure = if ($Measures.Count -gt $i) { $Measures[$i] } else { $null }
    $slot = @($layout.slots)[$i]
    $type = if ($i -eq 0) { 'KpiCard' } elseif ($measure -match '%|Rate|Ratio|Pct|YoY') { 'LineChart' } else { 'BarChart' }
    $visual = & (Join-Path $scriptRoot 'New-PowerBIVisualDraft.ps1') -VisualType $type -Title ($(if ($measure) { $measure } else { 'Overview' })) -Measure $measure -X $slot.x -Y $slot.y -Width $slot.width -Height $slot.height -Json | ConvertFrom-Json
    $visuals.Add($visual)
}

$pageId = ('page_{0}' -f ([guid]::NewGuid().ToString('N').Substring(0, 12)))
$result = [pscustomobject]@{
    schema = 'codex.powerbi.reportPageDraft.v1'
    pageId = $pageId
    pageName = $PageName
    displayName = $PageName
    pageSize = [pscustomobject]@{ width = $layout.pageWidth; height = $layout.pageHeight }
    visuals = @($visuals.ToArray())
    pbipDraft = [pscustomobject]@{
        name = $pageId
        displayName = $PageName
        width = $layout.pageWidth
        height = $layout.pageHeight
        visuals = @($visuals.ToArray() | ForEach-Object { $_.pbipDraft })
    }
    safety = 'Draft only. Apply to PBIP with Add-PowerBIPBIPReportPage.ps1 -Apply, then validate in Power BI Desktop.'
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 12; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

