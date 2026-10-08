param(
    [string]$Path = ".",
    [string]$OutputDirectory = "powerbi-semantic-test-fixtures",
    [int]$MaxMeasures = 5,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path
$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null

$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json | ConvertFrom-Json
$summary = try { & (Join-Path $scriptRoot 'Get-PowerBIInventory.ps1') -Path $root -Json | ConvertFrom-Json } catch { [pscustomobject]@{ tableCount = $null } }
$measures = @($catalog.metrics | Select-Object -First $MaxMeasures)

$fixtureRows = foreach ($measure in $measures) {
    [pscustomobject]@{
        Scenario = "baseline-$($measure.name -replace '[^A-Za-z0-9]+','-')"
        Metric = $measure.name
        Table = $measure.table
        Amount = 100
        Quantity = 2
        ExpectedNote = 'Replace with domain-approved expected value before enforcing.'
    }
}
$fixturePath = Join-Path $out 'semantic-fixture.csv'
$fixtureRows | Export-Csv -LiteralPath $fixturePath -NoTypeInformation -Encoding UTF8

$expectations = foreach ($measure in $measures) {
    [pscustomobject]@{
        measure = $measure.name
        table = $measure.table
        status = 'GeneratedFixture'
        daxQuery = ('EVALUATE ROW("{0}", [{0}])' -f ($measure.name -replace '"','""'))
        expectedValue = $null
        tolerance = 0
        fixture = Split-Path -Leaf $fixturePath
        privacy = 'Synthetic fixture only; no production rows exported.'
    }
}
$expectationDoc = [pscustomobject]@{
    schema = 'codex.powerbi.semanticTestFixtures.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    fixturePath = $fixturePath
    expectationCount = @($expectations).Count
    tableCount = $summary.tableCount
    expectations = @($expectations)
}
$expectationPath = Join-Path $out 'measure-expectations.json'
$expectationDoc | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $expectationPath -Encoding UTF8

$result = [pscustomobject]@{
    schema = 'codex.powerbi.semanticTestFixtureGenerator.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    outputDirectory = $out
    fixturePath = $fixturePath
    expectationsPath = $expectationPath
    fixtureRowCount = @($fixtureRows).Count
    expectationCount = @($expectations).Count
    nextStep = 'Fill expectedValue fields with domain-approved values, then run Invoke-PowerBISemanticTestRunner.ps1.'
}

if ($Json) { $result | ConvertTo-Json -Depth 8; return }
$result
