param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$profiles = foreach ($metric in @($catalog.metrics)) {
    $risk = 0; $signals = New-Object System.Collections.Generic.List[string]
    if ($metric.expression -match 'FILTER\s*\(\s*ALL\s*\(') { $risk += 35; $signals.Add('FILTER over ALL') }
    if ($metric.expression -match 'SUMX|AVERAGEX|COUNTX') { $risk += 20; $signals.Add('Iterator') }
    if ($metric.expression -match 'TODAY\s*\(|NOW\s*\(') { $risk += 15; $signals.Add('Volatile time') }
    if ($metric.expression.Length -gt 300) { $risk += 10; $signals.Add('Long expression') }
    [pscustomobject]@{ measure = $metric.name; estimatedRisk = $risk; riskBand = $(if ($risk -ge 50) { 'High' } elseif ($risk -ge 20) { 'Medium' } else { 'Low' }); signals = @($signals.ToArray()); daxStudioFollowUp = 'Use Server Timings and Query Plan for confirmation when DAX Studio is available.' }
}
$total = (@($profiles | Measure-Object -Property estimatedRisk -Sum).Sum)
$result = [pscustomobject]@{ schema = 'codex.powerbi.nativePerformanceProfile.v1'; root = $catalog.root; generated = (Get-Date).ToString('s'); profileCount = @($profiles).Count; totalEstimatedRisk = [int]$total; profiles = @($profiles | Sort-Object estimatedRisk -Descending) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Native Performance Profile', '', "Total estimated risk: $($result.totalEstimatedRisk)", '') + @($result.profiles | ForEach-Object { "- [$($_.riskBand)] $($_.measure): $($_.signals -join ', ')" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

