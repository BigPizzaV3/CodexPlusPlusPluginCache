param(
    [string]$Path = ".",
    [string]$BaselinePath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$current = & (Join-Path $scriptRoot 'New-PowerBIReportUXCritic.ps1') -Path $Path -Json | ConvertFrom-Json
$baseline = if ($BaselinePath -and (Test-Path -LiteralPath $BaselinePath)) {
    Get-Content -Raw -LiteralPath $BaselinePath | ConvertFrom-Json
}
else { $null }

$regressions = New-Object System.Collections.Generic.List[object]
if ($baseline) {
    $baselineMessages = @($baseline.findings | ForEach-Object { [string]$_.message })
    foreach ($finding in @($current.findings)) {
        if ($baselineMessages -notcontains [string]$finding.message) {
            $regressions.Add([pscustomobject]@{ severity = $finding.severity; source = $finding.source; message = $finding.message; recommendation = $finding.recommendation }) | Out-Null
        }
    }
}
else {
    foreach ($finding in @($current.findings)) {
        $regressions.Add([pscustomobject]@{ severity = $finding.severity; source = $finding.source; message = $finding.message; recommendation = 'No baseline supplied; treat this as the first UX regression snapshot.' }) | Out-Null
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.reportUxRegressionScanner.v1'
    root = $current.root
    generated = (Get-Date).ToString('s')
    baselineStatus = if ($baseline) { 'Available' } else { 'NotSupplied' }
    currentFindingCount = $current.findingCount
    regressionCount = $regressions.Count
    status = if ($regressions.Count -gt 0) { 'ReviewRequired' } else { 'NoRegressionDetected' }
    regressions = @($regressions.ToArray())
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Report UX Regression Scanner', '', ('Status: **{0}**' -f $result.status), '') + @($result.regressions | ForEach-Object { '- [{0}] {1}: {2}' -f $_.severity, $_.source, $_.message })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
