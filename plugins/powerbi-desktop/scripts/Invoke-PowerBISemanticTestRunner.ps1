param(
    [string]$Path = ".",
    [string]$ExpectationsPath,
    [string]$Server,
    [string]$OutputPath,
    [switch]$FailOnPending,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json

if (-not $ExpectationsPath) {
    $ExpectationsPath = Join-Path (Resolve-Path -LiteralPath $Path).Path 'measure-expectations.json'
}

$expectations = @()
if (Test-Path -LiteralPath $ExpectationsPath) {
    $loaded = Get-Content -Raw -LiteralPath $ExpectationsPath | ConvertFrom-Json
    if ($loaded.PSObject.Properties.Name -contains 'tests') { $expectations = @($loaded.tests) }
    elseif ($loaded.PSObject.Properties.Name -contains 'expectations') { $expectations = @($loaded.expectations) }
}

$expectationFile = $null
if ($expectations.Count -gt 0) {
    $expectationFile = [System.IO.Path]::GetTempFileName()
    try {
        [pscustomobject]@{
            schema = 'codex.powerbi.measureExpectations.v1'
            expectations = @($expectations | ForEach-Object {
                $name = if ($_.PSObject.Properties.Name -contains 'measure') { $_.measure } else { $_.name }
                $filters = if ($_.PSObject.Properties.Name -contains 'filters') { $_.filters } elseif ($_.PSObject.Properties.Name -contains 'filterContext' -and $_.filterContext -isnot [string]) { $_.filterContext } else { [pscustomobject]@{} }
                [pscustomobject]@{
                    measure = $name
                    expected = $_.expected
                    tolerance = if ($_.PSObject.Properties.Name -contains 'tolerance') { $_.tolerance } else { 0 }
                    filters = $filters
                    existsOnly = (($null -eq $_.expected) -or ($_.PSObject.Properties.Name -contains 'existsOnly' -and $_.existsOnly))
                }
            })
        } | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $expectationFile -Encoding UTF8

        $argsHash = @{
            Path = $Path
            ExpectationsPath = $expectationFile
            Json = $true
        }
        if ($Server) { $argsHash.Server = $Server }
        if ($FailOnPending) { $argsHash.FailOnPending = $true }
        $expectationResult = & (Join-Path $scriptRoot 'Test-PowerBIMeasureExpectations.ps1') @argsHash | ConvertFrom-Json
        $tests = @($expectationResult.checks | ForEach-Object {
            [pscustomobject]@{
                measure = $_.measure
                status = 'Configured'
                filterContext = $_.filters
                expected = $_.expected
                actual = $_.actual
                tolerance = $_.tolerance
                result = $_.status
                detail = $_.detail
                daxQuery = $_.daxQuery
                error = $_.error
            }
        })
    }
    finally {
        if ($expectationFile -and (Test-Path -LiteralPath $expectationFile)) {
            Remove-Item -LiteralPath $expectationFile -Force
        }
    }
}
else {
    $tests = @($catalog.metrics | ForEach-Object {
        [pscustomobject]@{
            measure = $_.name
            status = 'Generated'
            filterContext = [pscustomobject]@{}
            expected = '[TODO]'
            actual = $null
            tolerance = 0
            result = 'QueryGenerated'
            detail = 'No expectation supplied. Generated semantic test placeholder.'
            daxQuery = ('EVALUATE ROW("{0}", [{1}])' -f ($_.name -replace '"', '""'), ($_.name -replace ']', ']]'))
            error = $null
        }
    })
}

$failed = @($tests | Where-Object { $_.result -eq 'Failed' -or ($FailOnPending -and $_.result -eq 'PendingLiveDax') })
$pending = @($tests | Where-Object { $_.result -eq 'PendingLiveDax' })
$passed = @($tests | Where-Object { $_.result -in @('Passed', 'ExistsOnly', 'QueryGenerated') })
$result = [pscustomobject]@{
    schema = 'codex.powerbi.semanticTestRunner.v2'
    generated = (Get-Date).ToString('s')
    source = (Resolve-Path -LiteralPath $Path).Path
    expectationsPath = if (Test-Path -LiteralPath $ExpectationsPath) { (Resolve-Path -LiteralPath $ExpectationsPath).Path } else { $ExpectationsPath }
    status = if ($failed.Count -gt 0) { 'Failed' } elseif ($pending.Count -gt 0) { 'PendingLiveDax' } else { 'Passed' }
    testCount = @($tests).Count
    passedCount = $passed.Count
    failedCount = $failed.Count
    pendingCount = $pending.Count
    failOnPending = [bool]$FailOnPending
    tests = @($tests)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 12
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$lines = @(
    '# Semantic Test Runner',
    '',
    "Status: $($result.status)",
    "Tests: $($result.testCount)",
    "Passed: $($result.passedCount)",
    "Failed: $($result.failedCount)",
    "Pending: $($result.pendingCount)",
    '',
    '## Tests'
) + @($tests | ForEach-Object { "- [$($_.result)] $($_.measure): $($_.detail)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
