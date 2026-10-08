param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path).Path
$reportFiles = @(Get-ChildItem -LiteralPath $resolved -Recurse -File -Include report.json,pages.json,*.Report.json -ErrorAction SilentlyContinue)
$findings = New-Object System.Collections.Generic.List[object]
if ($reportFiles.Count -eq 0) {
    $findings.Add([pscustomobject]@{ severity = 'Info'; source = 'report metadata'; message = 'No report metadata files found. Export to PBIP to enable visual-level UX critique.'; recommendation = 'Use PBIP report files for page, visual, slicer, and layout review.' })
}
else {
    foreach ($file in $reportFiles) {
        $text = Get-Content -Raw -LiteralPath $file.FullName
        $visualCount = ([regex]::Matches($text, '"visual')).Count
        if ($visualCount -gt 12) { $findings.Add([pscustomobject]@{ severity = 'Medium'; source = $file.Name; message = "Detected $visualCount visual markers."; recommendation = 'Review page density and split crowded pages.' }) }
    }
}
$findingArray = @($findings.ToArray())
$result = [pscustomobject]@{ schema = 'codex.powerbi.reportUXCritic.v1'; root = $resolved; generated = (Get-Date).ToString('s'); findingCount = $findingArray.Count; findings = $findingArray }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Report UX Critic', '', "Findings: $($result.findingCount)", '') + @($result.findings | ForEach-Object { "- [$($_.severity)] $($_.source): $($_.message) $($_.recommendation)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
