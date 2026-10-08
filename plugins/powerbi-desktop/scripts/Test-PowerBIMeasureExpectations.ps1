param(
    [string]$Path = ".",
    [string]$ExpectationsPath,
    [string]$Server,
    [string]$OutputPath,
    [switch]$GenerateOnly,
    [switch]$FailOnPending,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json

function Escape-DaxIdentifierPart {
    param([string]$Value)
    return ($Value -replace ']', ']]')
}

function Escape-DaxString {
    param([string]$Value)
    return ($Value -replace '"', '""')
}

function New-DaxMeasureReference {
    param([object]$Metric, [string]$MeasureName)
    $measure = Escape-DaxIdentifierPart $MeasureName
    if ($Metric -and $Metric.table) {
        $table = ($Metric.table -replace "'", "''")
        return "'$table'[$measure]"
    }
    return "[$measure]"
}

function New-DaxFilterExpression {
    param([string]$Name, [object]$Value)
    $parts = @($Name -split '\.', 2)
    if ($parts.Count -ne 2 -or -not $parts[0] -or -not $parts[1]) {
        throw "Filter '$Name' must use Table.Column notation."
    }
    $table = ($parts[0] -replace "'", "''")
    $column = Escape-DaxIdentifierPart $parts[1]
    $values = if ($Value -is [array]) { @($Value) } else { @($Value) }
    $literals = foreach ($item in $values) {
        if ($null -eq $item) { 'BLANK()' }
        elseif ($item -is [bool]) { if ($item) { 'TRUE()' } else { 'FALSE()' } }
        elseif ($item -is [byte] -or $item -is [int16] -or $item -is [int32] -or $item -is [int64] -or $item -is [single] -or $item -is [double] -or $item -is [decimal]) {
            ([string]$item) -replace ',', '.'
        }
        else {
            '"' + (Escape-DaxString ([string]$item)) + '"'
        }
    }
    return ('TREATAS({{{0}}}, ''{1}''[{2}])' -f ($literals -join ', '), $table, $column)
}

function New-ExpectationDaxQuery {
    param([object]$Metric, [object]$Expectation)
    $label = Escape-DaxString ([string]$Expectation.measure)
    $measureRef = New-DaxMeasureReference -Metric $Metric -MeasureName $Expectation.measure
    $filters = New-Object System.Collections.Generic.List[string]
    if ($Expectation.PSObject.Properties.Name -contains 'filters' -and $Expectation.filters) {
        foreach ($filter in $Expectation.filters.PSObject.Properties) {
            $filters.Add((New-DaxFilterExpression -Name $filter.Name -Value $filter.Value))
        }
    }
    if ($filters.Count -gt 0) {
        return ('EVALUATE ROW("{0}", CALCULATE({1}, {2}))' -f $label, $measureRef, ($filters.ToArray() -join ', '))
    }
    return ('EVALUATE ROW("{0}", {1})' -f $label, $measureRef)
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

function Test-ExpectedValue {
    param([object]$Actual, [object]$Expected, [double]$Tolerance)
    $actualNumber = ConvertTo-ComparableNumber $Actual
    $expectedNumber = ConvertTo-ComparableNumber $Expected
    if ($null -ne $actualNumber -and $null -ne $expectedNumber) {
        return ([Math]::Abs($actualNumber - $expectedNumber) -le $Tolerance)
    }
    return ([string]$Actual -eq [string]$Expected)
}

if (-not $ExpectationsPath) {
    $ExpectationsPath = Join-Path (Resolve-Path -LiteralPath $Path).Path 'measure-expectations.json'
}

if (-not (Test-Path -LiteralPath $ExpectationsPath)) {
    $template = [pscustomobject]@{
        schema = 'codex.powerbi.measureExpectations.v1'
        expectations = @($catalog.metrics | Select-Object -First 3 | ForEach-Object {
            [pscustomobject]@{ measure = $_.name; expected = $null; tolerance = 0; filters = [pscustomobject]@{}; existsOnly = $true }
        })
    }
    $result = [pscustomobject]@{
        schema = 'codex.powerbi.measureExpectationResults.v1'
        generated = (Get-Date).ToString('s')
        status = 'TemplateCreated'
        expectationsPath = $ExpectationsPath
        checkCount = 0
        passedCount = 0
        failedCount = 0
        pendingCount = 0
        checks = @()
    }
    $template | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ExpectationsPath -Encoding UTF8
}
else {
    $expectations = Get-Content -Raw -LiteralPath $ExpectationsPath | ConvertFrom-Json
    $queryScript = Join-Path $scriptRoot 'Invoke-PowerBILiveDaxQuery.ps1'
    $checks = foreach ($expectation in @($expectations.expectations)) {
        $metric = @($catalog.metrics | Where-Object { $_.name -eq $expectation.measure } | Select-Object -First 1)
        $exists = $metric.Count -gt 0
        $hasExpected = ($expectation.PSObject.Properties.Name -contains 'expected') -and ($null -ne $expectation.expected)
        $existsOnly = ($expectation.PSObject.Properties.Name -contains 'existsOnly') -and ([bool]$expectation.existsOnly)
        $tolerance = if ($expectation.PSObject.Properties.Name -contains 'tolerance' -and $null -ne $expectation.tolerance) { [double]$expectation.tolerance } else { 0.0 }
        $query = if ($exists) { New-ExpectationDaxQuery -Metric $metric[0] -Expectation $expectation } else { $null }
        $status = $null
        $actual = $null
        $errorText = $null
        $detail = $null

        if (-not $exists) {
            $status = 'Failed'
            $detail = 'Measure not found in catalog.'
        }
        elseif ($GenerateOnly) {
            $status = 'QueryGenerated'
            $detail = 'DAX query generated; live execution was not requested.'
        }
        elseif ($existsOnly -or -not $hasExpected) {
            $status = 'ExistsOnly'
            $detail = 'Expectation only checks that the measure exists in the local catalog.'
        }
        elseif (-not $Server) {
            $status = 'PendingLiveDax'
            $detail = 'Expected value requires a live DAX server; no server was supplied.'
        }
        else {
            try {
                $live = & $queryScript -Server $Server -Query $query -Json | ConvertFrom-Json
                if (@($live.rows).Count -eq 0) {
                    $status = 'Failed'
                    $detail = 'Live DAX query returned no rows.'
                }
                else {
                    $props = @($live.rows[0].PSObject.Properties)
                    $actual = if ($props.Count -gt 0) { $props[0].Value } else { $null }
                    if (Test-ExpectedValue -Actual $actual -Expected $expectation.expected -Tolerance $tolerance) {
                        $status = 'Passed'
                        $detail = 'Actual value matched expected value within tolerance.'
                    }
                    else {
                        $status = 'Failed'
                        $detail = 'Actual value did not match expected value within tolerance.'
                    }
                }
            }
            catch {
                $status = 'PendingLiveDax'
                $errorText = $_.Exception.Message
                $detail = 'Live DAX execution was not available.'
            }
        }

        [pscustomobject]@{
            measure = $expectation.measure
            status = $status
            passed = ($status -in @('Passed', 'ExistsOnly', 'QueryGenerated'))
            expected = $expectation.expected
            actual = $actual
            tolerance = $tolerance
            filters = $expectation.filters
            daxQuery = $query
            detail = $detail
            error = $errorText
        }
    }
    $pending = @($checks | Where-Object { $_.status -eq 'PendingLiveDax' })
    $failed = @($checks | Where-Object { $_.status -eq 'Failed' -or ($FailOnPending -and $_.status -eq 'PendingLiveDax') })
    $result = [pscustomobject]@{
        schema = 'codex.powerbi.measureExpectationResults.v1'
        generated = (Get-Date).ToString('s')
        status = if ($failed.Count -gt 0) { 'Failed' } elseif ($pending.Count -gt 0) { 'PendingLiveDax' } else { 'Passed' }
        expectationsPath = $ExpectationsPath
        checkCount = @($checks).Count
        passedCount = @($checks | Where-Object { $_.status -in @('Passed', 'ExistsOnly', 'QueryGenerated') }).Count
        failedCount = $failed.Count
        pendingCount = $pending.Count
        failOnPending = [bool]$FailOnPending
        checks = @($checks)
    }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 12
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Measure Expectations')
$md.Add('')
$md.Add(('Status: {0}' -f $result.status))
$md.Add(('Expectations path: `{0}`' -f $result.expectationsPath))
$md.Add(('Checks: {0}' -f $result.checkCount))
$md.Add(('Passed: {0}' -f $result.passedCount))
$md.Add(('Failed: {0}' -f $result.failedCount))
$md.Add(('Pending: {0}' -f $result.pendingCount))
$md.Add('')
foreach ($check in @($result.checks)) {
    $md.Add(('## [{0}] {1}' -f $check.status, $check.measure))
    $md.Add(('- Detail: {0}' -f $check.detail))
    if ($null -ne $check.actual) { $md.Add(('- Actual: `{0}`' -f $check.actual)) }
    if ($null -ne $check.expected) { $md.Add(('- Expected: `{0}`' -f $check.expected)) }
    if ($check.error) { $md.Add(('- Error: {0}' -f $check.error)) }
    if ($check.daxQuery) {
        $md.Add('')
        $md.Add('```DAX')
        $md.Add($check.daxQuery)
        $md.Add('```')
    }
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
