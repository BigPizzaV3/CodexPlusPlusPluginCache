param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path).Path
$jsonFiles = @(Get-ChildItem -LiteralPath $resolved -Recurse -File -Include page.json,report.json,pages.json -ErrorAction SilentlyContinue)
$findings = New-Object System.Collections.Generic.List[object]
if ($jsonFiles.Count -eq 0) { $findings.Add([pscustomobject]@{ severity = 'Info'; source = 'report'; message = 'No PBIP report JSON found. Export report to PBIP for native layout analysis.' }) }
foreach ($file in $jsonFiles) {
    $text = Get-Content -Raw -LiteralPath $file.FullName
    $visualMarkers = ([regex]::Matches($text, '"visual|visualType|displayName"')).Count
    if ($visualMarkers -gt 20) { $findings.Add([pscustomobject]@{ severity = 'Medium'; source = $file.Name; message = 'High visual density detected.' }) }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.reportLayoutBestPractices.v1'; root = $resolved; generated = (Get-Date).ToString('s'); findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

