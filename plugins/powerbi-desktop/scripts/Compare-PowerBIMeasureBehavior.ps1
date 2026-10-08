param(
    [string]$BeforePath,
    [string]$AfterPath,
    [string]$Path = ".",
    [string]$ExpectationsPath,
    [string]$BaselineResultsPath,
    [string]$CurrentResultsPath,
    [string]$BaselineServer,
    [string]$CurrentServer,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function ConvertTo-StableJson {
    param([object]$Value)
    if ($null -eq $Value) { return '{}' }
    return ($Value | ConvertTo-Json -Depth 12 -Compress)
}

function ConvertTo-ComparableNumber {
    param([object]$Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64] -or $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
        return [double]$Value
    }
    $parsed = 0.0
    if ([double]::TryParse([string]$Value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
        return $parsed
    }
    return $null
}

function Compare-Values {
    param([object]$Baseline, [object]$Current, [double]$Tolerance)
    $baselineNumber = ConvertTo-ComparableNumber $Baseline
    $currentNumber = ConvertTo-ComparableNumber $Current
    if ($null -ne $baselineNumber -and $null -ne $currentNumber) {
        $delta = $currentNumber - $baselineNumber
        return [pscustomobject]@{
            passed = ([Math]::Abs($delta) -le $Tolerance)
            delta = $delta
        }
    }
    return [pscustomobject]@{
        passed = ([string]$Baseline -eq [string]$Current)
        delta = $null
    }
}

function Read-MeasureResults {
    param([string]$FilePath)
    $doc = Get-Content -Raw -LiteralPath $FilePath | ConvertFrom-Json
    if ($doc.PSObject.Properties.Name -contains 'checks') { return @($doc.checks) }
    if ($doc.PSObject.Properties.Name -contains 'tests') { return @($doc.tests) }
    if ($doc.PSObject.Properties.Name -contains 'results') { return @($doc.results) }
    throw "Unsupported measure result file: $FilePath"
}

function New-ResultKey {
    param([object]$Item)
    $measure = if ($Item.PSObject.Properties.Name -contains 'measure') { $Item.measure } elseif ($Item.PSObject.Properties.Name -contains 'name') { $Item.name } else { '' }
    $filters = if ($Item.PSObject.Properties.Name -contains 'filters') { $Item.filters } elseif ($Item.PSObject.Properties.Name -contains 'filterContext') { $Item.filterContext } else { $null }
    return ('{0}|{1}' -f $measure, (ConvertTo-StableJson $filters))
}

function Get-ItemValue {
    param([object]$Item)
    if ($Item.PSObject.Properties.Name -contains 'actual') { return $Item.actual }
    if ($Item.PSObject.Properties.Name -contains 'value') { return $Item.value }
    return $null
}

function Get-ItemTolerance {
    param([object]$Item)
    if ($Item.PSObject.Properties.Name -contains 'tolerance' -and $null -ne $Item.tolerance) { return [double]$Item.tolerance }
    return 0.0
}

$comparisons = @()
$mode = $null

if ($BaselineResultsPath -and $CurrentResultsPath) {
    $mode = 'ResultFiles'
    $baseline = Read-MeasureResults -FilePath $BaselineResultsPath
    $current = Read-MeasureResults -FilePath $CurrentResultsPath
    $baselineByKey = @{}
    foreach ($item in $baseline) { $baselineByKey[(New-ResultKey $item)] = $item }
    $currentByKey = @{}
    foreach ($item in $current) { $currentByKey[(New-ResultKey $item)] = $item }
    $keys = @($baselineByKey.Keys + $currentByKey.Keys | Sort-Object -Unique)
    $comparisons = foreach ($key in $keys) {
        $base = $baselineByKey[$key]
        $curr = $currentByKey[$key]
        $measure = if ($curr) { $curr.measure } elseif ($base.PSObject.Properties.Name -contains 'measure') { $base.measure } else { $base.name }
        $filters = if ($curr -and $curr.PSObject.Properties.Name -contains 'filters') { $curr.filters } elseif ($base -and $base.PSObject.Properties.Name -contains 'filters') { $base.filters } else { $null }
        if (-not $base -or -not $curr) {
            [pscustomobject]@{
                measure = $measure
                filterContext = $filters
                status = 'Failed'
                baseline = if ($base) { Get-ItemValue $base } else { $null }
                current = if ($curr) { Get-ItemValue $curr } else { $null }
                delta = $null
                tolerance = if ($curr) { Get-ItemTolerance $curr } else { 0 }
                detail = 'Measure/context exists only on one side of the comparison.'
            }
            continue
        }
        $tolerance = Get-ItemTolerance $curr
        $comparison = Compare-Values -Baseline (Get-ItemValue $base) -Current (Get-ItemValue $curr) -Tolerance $tolerance
        [pscustomobject]@{
            measure = $measure
            filterContext = $filters
            status = if ($comparison.passed) { 'Passed' } else { 'Failed' }
            baseline = Get-ItemValue $base
            current = Get-ItemValue $curr
            delta = $comparison.delta
            tolerance = $tolerance
            detail = if ($comparison.passed) { 'Current value matches baseline within tolerance.' } else { 'Current value differs from baseline beyond tolerance.' }
        }
    }
}
elseif ($ExpectationsPath -and $BaselineServer -and $CurrentServer) {
    $mode = 'LiveDax'
    $baselineFile = [System.IO.Path]::GetTempFileName()
    $currentFile = [System.IO.Path]::GetTempFileName()
    try {
        & (Join-Path $scriptRoot 'Test-PowerBIMeasureExpectations.ps1') -Path $Path -ExpectationsPath $ExpectationsPath -Server $BaselineServer -OutputPath $baselineFile -Json | Out-Null
        & (Join-Path $scriptRoot 'Test-PowerBIMeasureExpectations.ps1') -Path $Path -ExpectationsPath $ExpectationsPath -Server $CurrentServer -OutputPath $currentFile -Json | Out-Null
        $reinvoke = & $PSCommandPath -BaselineResultsPath $baselineFile -CurrentResultsPath $currentFile -Json | ConvertFrom-Json
        $comparisons = @($reinvoke.comparisons)
    }
    finally {
        if (Test-Path -LiteralPath $baselineFile) { Remove-Item -LiteralPath $baselineFile -Force }
        if (Test-Path -LiteralPath $currentFile) { Remove-Item -LiteralPath $currentFile -Force }
    }
}
elseif ($ExpectationsPath) {
    $mode = 'Plan'
    $generated = & (Join-Path $scriptRoot 'Test-PowerBIMeasureExpectations.ps1') -Path $Path -ExpectationsPath $ExpectationsPath -GenerateOnly -Json | ConvertFrom-Json
    $comparisons = @($generated.checks | ForEach-Object {
        [pscustomobject]@{
            measure = $_.measure
            filterContext = $_.filters
            status = 'NotAvailable'
            baseline = $null
            current = $null
            delta = $null
            tolerance = $_.tolerance
            daxQuery = $_.daxQuery
            detail = 'Baseline/current live servers or result files were not supplied; deterministic comparison plan only.'
        }
    })
}
elseif ($BeforePath -and $AfterPath) {
    $mode = 'ModelDiffPlan'
    $diff = & (Join-Path $scriptRoot 'Compare-PowerBISemanticModel.ps1') -BeforePath $BeforePath -AfterPath $AfterPath -Json | ConvertFrom-Json
    $tests = & (Join-Path $scriptRoot 'New-PowerBIMeasureTestPlan.ps1') -Path $AfterPath -Json | ConvertFrom-Json
    $comparisons = foreach ($change in @($diff.changes)) {
        [pscustomobject]@{
            id = $change.id
            changeType = $change.type
            behaviorRisk = $change.risk
            status = 'NotAvailable'
            validationQueries = @($tests.tests | Where-Object { $_.measure -eq (($change.id -split '\.')[-1] -replace '-', ' ') } | Select-Object -ExpandProperty daxQuery)
            tolerance = 'Business owner defines acceptable variance.'
            detail = 'Model metadata changed; supply result files or live servers for value comparison.'
            rollbackNote = 'Revert changed measure expression from previous PBIP/TMDL version if validation fails.'
        }
    }
}
else {
    $mode = 'Plan'
    $comparisons = @()
}

$failed = @($comparisons | Where-Object { $_.status -eq 'Failed' })
$notAvailable = @($comparisons | Where-Object { $_.status -eq 'NotAvailable' })
$result = [pscustomobject]@{
    schema = 'codex.powerbi.measureBehaviorComparison.v2'
    mode = $mode
    generated = (Get-Date).ToString('s')
    status = if ($failed.Count -gt 0) { 'Failed' } elseif ($notAvailable.Count -gt 0) { 'NotAvailable' } else { 'Passed' }
    comparisonCount = @($comparisons).Count
    failedCount = $failed.Count
    notAvailableCount = $notAvailable.Count
    comparisons = @($comparisons)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 12
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}
$md = @(
    '# Power BI Measure Behavior Diff',
    '',
    "Mode: $($result.mode)",
    "Status: $($result.status)",
    "Comparisons: $($result.comparisonCount)",
    "Failed: $($result.failedCount)",
    "Not available: $($result.notAvailableCount)",
    ''
) + @($comparisons | ForEach-Object {
    $name = if ($_.PSObject.Properties.Name -contains 'measure') { $_.measure } else { $_.id }
    "- [$($_.status)] $name - $($_.detail)"
})
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
