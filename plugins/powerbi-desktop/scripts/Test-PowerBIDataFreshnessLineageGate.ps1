param(
    [string]$Path = ".",
    [string]$ReviewDirectory,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path
$service = if ($ReviewDirectory -and (Test-Path -LiteralPath (Join-Path $ReviewDirectory 'service-scanner.json'))) {
    Get-Content -Raw -LiteralPath (Join-Path $ReviewDirectory 'service-scanner.json') | ConvertFrom-Json
}
else {
    & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $root -Json | ConvertFrom-Json
}
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $root -Json | ConvertFrom-Json
$dataContract = & (Join-Path $scriptRoot 'New-PowerBIDataContract.ps1') -Path $root -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
if ($service.findingCount -gt 0) {
    foreach ($finding in @($service.findings | Select-Object -First 10)) {
        $findings.Add([pscustomobject]@{ severity = (($finding.severity, 'Medium' | Where-Object { $_ })[0]); area = 'ServiceScanner'; message = (($finding.message, $finding.title, 'Service scanner finding') | Where-Object { $_ })[0] }) | Out-Null
    }
}
if ($structure.roundtripStatus -ne 'Ready') {
    $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'PBIPLineage'; message = 'PBIP structure is not fully roundtrip-ready, reducing lineage confidence.' }) | Out-Null
}
if ($dataContract.contractStatus -and $dataContract.contractStatus -ne 'Ready') {
    $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'DataContract'; message = ('Data contract status is {0}.' -f $dataContract.contractStatus) }) | Out-Null
}
elseif (-not $dataContract.contractStatus) {
    $findings.Add([pscustomobject]@{ severity = 'Medium'; area = 'DataContract'; message = 'Data freshness SLA and owner evidence are not explicit.' }) | Out-Null
}

$high = @($findings.ToArray() | Where-Object { $_.severity -eq 'High' }).Count
$result = [pscustomobject]@{
    schema = 'codex.powerbi.dataFreshnessLineageGate.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    serviceScannerStatus = (($service.status, 'Available' | Where-Object { $_ })[0])
    pbipRoundtripStatus = $structure.roundtripStatus
    dataContractStatus = (($dataContract.contractStatus, $dataContract.status, 'Unknown' | Where-Object { $_ })[0])
    findingCount = $findings.Count
    status = if ($high -gt 0) { 'Blocked' } elseif ($findings.Count -gt 0) { 'Warn' } else { 'Passed' }
    findings = @($findings.ToArray())
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Data Freshness And Lineage Gate', '', ('Status: **{0}**' -f $result.status), '') + @($result.findings | ForEach-Object { '- [{0}] {1}: {2}' -f $_.severity, $_.area, $_.message })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
