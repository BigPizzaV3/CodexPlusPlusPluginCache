param([string]$GroupName = 'Time Intelligence', [string]$BaseMeasure = 'Selected Measure', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$items = @(
    [pscustomobject]@{ name = 'Current'; expression = 'SELECTEDMEASURE()'; formatStringExpression = 'SELECTEDMEASUREFORMATSTRING()' },
    [pscustomobject]@{ name = 'Prior Year'; expression = 'CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(''Date''[Date]))'; formatStringExpression = 'SELECTEDMEASUREFORMATSTRING()' },
    [pscustomobject]@{ name = 'YoY %'; expression = 'DIVIDE(SELECTEDMEASURE() - CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(''Date''[Date])), CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(''Date''[Date])))'; formatStringExpression = '"0.0%"' }
)
$tmdl = "calculationGroup $GroupName`n    precedence: 10`n"
foreach ($item in $items) { $tmdl += "    calculationItem $($item.name) = ```$($item.expression)```n" }
$result = [pscustomobject]@{ schema = 'codex.powerbi.calculationGroupDraft.v1'; objectType = 'CalculationGroup'; groupName = $GroupName; baseMeasure = $BaseMeasure; items = $items; tmdl = $tmdl; safety = 'Draft only. Apply through PBIP/TMDL or Tabular Editor after validation.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

