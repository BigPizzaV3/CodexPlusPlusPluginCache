param([string]$ThemePath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$findings = New-Object System.Collections.Generic.List[object]
if (-not $ThemePath -or -not (Test-Path -LiteralPath $ThemePath)) { $findings.Add([pscustomobject]@{ severity = 'Info'; source = 'theme'; message = 'No theme file provided.' }) }
else {
    $theme = Get-Content -Raw -LiteralPath $ThemePath | ConvertFrom-Json
    if (-not $theme.name) { $findings.Add([pscustomobject]@{ severity = 'Low'; source = 'theme'; message = 'Theme name missing.' }) }
    if (-not $theme.dataColors) { $findings.Add([pscustomobject]@{ severity = 'Medium'; source = 'theme'; message = 'Theme dataColors missing.' }) }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.themeAudit.v1'; generated = (Get-Date).ToString('s'); findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

