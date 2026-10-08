param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue)
$findings = New-Object System.Collections.Generic.List[object]
if (-not $resolved) {
    $findings.Add([pscustomobject]@{ severity = 'High'; source = $Path; message = 'Path does not exist.' })
} else {
    $jsonFiles = @(Get-ChildItem -LiteralPath $resolved.Path -Recurse -File -Include page.json,*.visual.json,report.json -ErrorAction SilentlyContinue)
    if ($jsonFiles.Count -eq 0) { $findings.Add([pscustomobject]@{ severity = 'Info'; source = 'PBIP report'; message = 'No PBIP report visual JSON found. Export report to PBIP for strict schema validation.' }) }
    foreach ($file in $jsonFiles) {
        try { Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json | Out-Null }
        catch { $findings.Add([pscustomobject]@{ severity = 'High'; source = $file.FullName; message = "Invalid JSON: $($_.Exception.Message)" }) }
    }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.visualSchemaCheck.v1'; generated = (Get-Date).ToString('s'); findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

