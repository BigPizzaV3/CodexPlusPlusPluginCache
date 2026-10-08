param([string]$Path = ".", [string]$OverridePath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $Path).Path
$template = @(
    [pscustomobject]@{ date = (Get-Date).ToString('yyyy-MM-dd'); artifact = 'trust-release-gate'; metric = 'Total Sales'; aiRecommendation = 'Warn'; humanOverride = 'Go'; reason = 'Validated against finance close workbook.'; actualOutcome = 'Accepted'; owner = 'Finance BI Owner' }
)
$overrides = @()
if ($OverridePath -and (Test-Path -LiteralPath $OverridePath)) {
    if ([System.IO.Path]::GetExtension($OverridePath).ToLowerInvariant() -eq '.csv') { $overrides = @(Import-Csv -LiteralPath $OverridePath) }
    else {
        $loaded = Get-Content -Raw -LiteralPath $OverridePath | ConvertFrom-Json
        $overrides = if ($loaded.PSObject.Properties.Name -contains 'overrides') { @($loaded.overrides) } else { @($loaded) }
    }
}
$signals = foreach ($item in $overrides) {
    $reason = [string]$item.reason
    $category = if ($reason -match '(?i)bias|overstated|understated') { 'model_bias' } elseif ($reason -match '(?i)late|latency|refresh') { 'data_latency' } elseif ($reason -match '(?i)owner|preference|judgment') { 'owner_preference' } elseif ($reason -match '(?i)release|risk|gate') { 'release_risk_override' } else { 'business_context_gap' }
    [pscustomobject]@{ metric = $item.metric; category = $category; reason = $item.reason; owner = $item.owner; actualOutcome = $item.actualOutcome }
}
$bias = @($signals | Where-Object category -eq 'model_bias')
$result = [pscustomobject]@{
    schema = 'codex.powerbi.humanOverrideLearning.v1'
    generated = (Get-Date).ToString('s')
    source = $source
    status = if ($OverridePath -and (Test-Path -LiteralPath $OverridePath)) { 'LearningReady' } else { 'NeedsOverrideInput' }
    overrideCount = @($overrides).Count
    learningSignals = @($signals)
    biasFindings = @($bias)
    learningReadinessScore = if (@($overrides).Count -gt 0) { [math]::Min(100, 40 + (@($overrides).Count * 10)) } else { 25 }
    captureTemplate = @($template)
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 10; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Human Override Learning', '', "Status: **$($result.status)**", "Overrides: $($result.overrideCount)", '') + @($result.learningSignals | ForEach-Object { "- $($_.metric): $($_.category) - $($_.reason)" })
if ($result.overrideCount -eq 0) { $md += @('', '## Capture Template', '', '| date | artifact | metric | aiRecommendation | humanOverride | reason | actualOutcome | owner |', '| --- | --- | --- | --- | --- | --- | --- | --- |') }
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
