param(
    [ValidateSet('KpiCard','BarChart','LineChart','Matrix','Table','Slicer','Tooltip','Drillthrough')]
    [string]$VisualType = 'KpiCard',
    [string]$Title = 'New Visual',
    [string]$Measure,
    [string]$Category,
    [int]$X = 32,
    [int]$Y = 32,
    [int]$Width = 600,
    [int]$Height = 300,
    [string]$OutputPath,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'

$visualId = ('visual_{0}' -f ([guid]::NewGuid().ToString('N').Substring(0, 12)))
$visual = [ordered]@{
    schema = 'codex.powerbi.visualDraft.v1'
    visualId = $visualId
    visualType = $VisualType
    title = $Title
    measure = $Measure
    category = $Category
    layout = [ordered]@{ x = $X; y = $Y; width = $Width; height = $Height }
    pbipDraft = [ordered]@{
        name = $visualId
        displayName = $Title
        visualType = $VisualType
        projections = [ordered]@{
            Values = @($Measure | Where-Object { $_ })
            Category = @($Category | Where-Object { $_ })
        }
        position = [ordered]@{ x = $X; y = $Y; width = $Width; height = $Height }
    }
    safety = 'PBIP report JSON draft. Validate in Power BI Desktop before publishing.'
}

$result = [pscustomobject]$visual
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

