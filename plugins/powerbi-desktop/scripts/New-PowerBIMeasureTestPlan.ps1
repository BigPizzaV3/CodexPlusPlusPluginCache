param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$tests = New-Object System.Collections.Generic.List[object]

foreach ($metric in @($catalog.metrics)) {
    $measureRef = ('{0}[{1}]' -f $metric.table, $metric.name)
    $tests.Add([pscustomobject]@{
        measure = $metric.name
        table = $metric.table
        testType = 'Smoke'
        intent = 'Measure evaluates without an exception in the default filter context.'
        daxQuery = ('EVALUATE ROW("{0}", [{0}])' -f $metric.name)
    })
    $tests.Add([pscustomobject]@{
        measure = $metric.name
        table = $metric.table
        testType = 'BlankOrZero'
        intent = 'Measure returns a value, blank, or zero intentionally; reviewer confirms semantics.'
        daxQuery = ('EVALUATE ROW("IsBlank", ISBLANK([{0}]), "Value", [{0}])' -f $metric.name)
    })
    $tests.Add([pscustomobject]@{
        measure = $metric.name
        table = $metric.table
        testType = 'FilterContext'
        intent = 'Measure is stable under a summarized table context.'
        daxQuery = ('EVALUATE TOPN(10, SUMMARIZECOLUMNS("{0}", [{0}]))' -f $metric.name)
    })
    if (($metric.tags -contains 'ratio') -or $metric.name -match '%|Rate|Ratio|Pct') {
        $tests.Add([pscustomobject]@{
            measure = $metric.name
            table = $metric.table
            testType = 'Range'
            intent = 'Ratio-like measure should be reviewed for expected bounds.'
            daxQuery = ('EVALUATE ROW("BelowZero", [{0}] < 0, "AboveOne", [{0}] > 1, "Value", [{0}])' -f $metric.name)
        })
    }
}

$testArray = @($tests.ToArray())
$result = [pscustomobject]@{
    schema = 'codex.powerbi.measureTestPlan.v1'
    root = $catalog.root
    generated = (Get-Date).ToString('s')
    measureCount = $catalog.metricCount
    testCount = $testArray.Count
    tests = $testArray
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Measure Test Plan')
$md.Add('')
$md.Add(('Measures: {0}' -f $result.measureCount))
$md.Add(('Tests: {0}' -f $result.testCount))
$md.Add('')
foreach ($test in $result.tests) {
    $md.Add(('## {0}: {1}' -f $test.measure, $test.testType))
    $md.Add($test.intent)
    $md.Add('')
    $md.Add('```DAX')
    $md.Add($test.daxQuery)
    $md.Add('```')
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
