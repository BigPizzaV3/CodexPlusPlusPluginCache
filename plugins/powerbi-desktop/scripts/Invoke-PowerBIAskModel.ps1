param(
    [string]$Path = ".",
    [Parameter(Mandatory=$true)][string]$Question,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$lineage = & (Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json | ConvertFrom-Json
$tokens = @($Question -split '[^\p{L}\p{Nd}_%]+' | Where-Object { $_.Length -gt 2 })

$matches = foreach ($metric in @($catalog.metrics)) {
    $score = 0
    foreach ($token in $tokens) {
        if ($metric.name -match [regex]::Escape($token)) { $score += 5 }
        if ($metric.expression -match [regex]::Escape($token)) { $score += 2 }
        if ((@($metric.tags) -join ' ') -match [regex]::Escape($token)) { $score += 1 }
    }
    if ($score -gt 0) {
        $impact = @($lineage.measures | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
        [pscustomobject]@{
            measure = $metric.name
            table = $metric.table
            score = $score
            risks = @($metric.risks)
            downstreamMeasures = if ($impact.Count) { @($impact[0].downstreamMeasures) } else { @() }
            expression = $metric.expression
        }
    }
}
$ranked = @($matches | Sort-Object score -Descending | Select-Object -First 10)
$answer = if ($ranked.Count -gt 0) {
    'Relevant measures: ' + (($ranked | Select-Object -ExpandProperty measure) -join ', ')
} else {
    'No directly matching measure was found in the local catalog.'
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.askModel.v1'
    generated = (Get-Date).ToString('s')
    question = $Question
    answer = $answer
    matchCount = $ranked.Count
    matches = @($ranked)
}
if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$result.answer
