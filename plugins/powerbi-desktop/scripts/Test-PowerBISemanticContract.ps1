param(
    [string]$Path = ".",
    [string]$ContractPath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$contract = if ($ContractPath -and (Test-Path -LiteralPath $ContractPath)) {
    Get-Content -Raw -LiteralPath $ContractPath | ConvertFrom-Json
}
else {
    & (Join-Path $scriptRoot 'New-PowerBIKpiTrustContract.ps1') -Path $Path -Json | ConvertFrom-Json
}
$tests = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $Path -Json | ConvertFrom-Json
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
foreach ($metric in @($catalog.metrics)) {
    if ($metric.owner -match '\[TODO' -or [string]::IsNullOrWhiteSpace($metric.owner)) {
        $findings.Add([pscustomobject]@{ severity = 'High'; metric = $metric.name; contractArea = 'Owner'; message = 'Metric owner is missing.' }) | Out-Null
    }
    if ($metric.businessDefinition -match '\[TODO' -or [string]::IsNullOrWhiteSpace($metric.businessDefinition)) {
        $findings.Add([pscustomobject]@{ severity = 'High'; metric = $metric.name; contractArea = 'BusinessDefinition'; message = 'Business definition is missing.' }) | Out-Null
    }
}
foreach ($test in @($tests.tests | Where-Object { $_.result -in @('PendingLiveDax','NotRun') -or $_.status -eq 'Generated' })) {
    $measureCandidates = @($test.measure, $test.measureName, $test.metricName) | Where-Object { $_ }
    $measure = if ($measureCandidates.Count -gt 0) { [string]$measureCandidates[0] } else { 'Unknown metric' }
    $findings.Add([pscustomobject]@{ severity = 'Medium'; metric = $measure; contractArea = 'ExecutableExpectation'; message = 'Semantic expectation is not backed by executed evidence.' }) | Out-Null
}

$high = @($findings.ToArray() | Where-Object { $_.severity -eq 'High' }).Count
$medium = @($findings.ToArray() | Where-Object { $_.severity -eq 'Medium' }).Count
$result = [pscustomobject]@{
    schema = 'codex.powerbi.semanticContractTest.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    contractSource = if ($ContractPath) { $ContractPath } else { 'GeneratedFromModel' }
    metricCount = $catalog.metricCount
    testCount = $tests.testCount
    findingCount = $findings.Count
    highCount = $high
    mediumCount = $medium
    status = if ($high -gt 0) { 'ContractFailed' } elseif ($medium -gt 0) { 'ContractWithCaveats' } else { 'ContractPassed' }
    contract = $contract
    findings = @($findings.ToArray())
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 10; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Semantic Contract Test', '', ('Status: **{0}**' -f $result.status), ('Findings: {0}' -f $result.findingCount), '') + @($result.findings | ForEach-Object { '- [{0}] `{1}` {2}: {3}' -f $_.severity, $_.metric, $_.contractArea, $_.message })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
