param(
    [string]$PageName = 'New Page',
    [int]$VisualCount = 4,
    [int]$PageWidth = 1280,
    [int]$PageHeight = 720,
    [string]$OutputPath,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'

$slots = New-Object System.Collections.Generic.List[object]
$margin = 32
$gap = 20
if ($VisualCount -le 1) {
    $slots.Add([pscustomobject]@{ x = $margin; y = $margin; width = $PageWidth - (2 * $margin); height = $PageHeight - (2 * $margin) })
}
else {
    $columns = if ($VisualCount -le 2) { 2 } else { 2 }
    $rows = [math]::Ceiling($VisualCount / $columns)
    $slotWidth = [int](($PageWidth - (2 * $margin) - (($columns - 1) * $gap)) / $columns)
    $slotHeight = [int](($PageHeight - (2 * $margin) - (($rows - 1) * $gap)) / $rows)
    for ($i = 0; $i -lt $VisualCount; $i++) {
        $col = $i % $columns
        $row = [math]::Floor($i / $columns)
        $slots.Add([pscustomobject]@{ x = $margin + ($col * ($slotWidth + $gap)); y = $margin + ($row * ($slotHeight + $gap)); width = $slotWidth; height = $slotHeight })
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.reportLayoutPlan.v1'
    pageName = $PageName
    pageWidth = $PageWidth
    pageHeight = $PageHeight
    slotCount = $slots.Count
    slots = @($slots.ToArray())
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

