$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'
$samplePath = Join-Path $pluginRoot 'examples/sample-model'

Describe 'Semantic runner and measure behavior diff' {
    It 'keeps expected measure checks pending without a live DAX server' {
        $tmp = Join-Path $pluginRoot 'tmp/pester-semantic'
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        $expectationsPath = Join-Path $tmp 'measure-expectations.json'
        [pscustomobject]@{
            schema = 'codex.powerbi.measureExpectations.v1'
            expectations = @(
                [pscustomobject]@{
                    measure = 'Total Sales'
                    expected = 100
                    tolerance = 0.01
                    filters = [pscustomobject]@{ 'Sales.Region' = 'West' }
                }
            )
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $expectationsPath -Encoding UTF8

        $result = & (Join-Path $scriptsPath 'Invoke-PowerBISemanticTestRunner.ps1') -Path $samplePath -ExpectationsPath $expectationsPath -FailOnPending -Json | ConvertFrom-Json

        $result.status | Should Be 'Failed'
        $result.failedCount | Should Be 1
        $result.pendingCount | Should Be 1
        $result.tests[0].result | Should Be 'PendingLiveDax'
    }

    It 'generates escaped DAX query strings and distinct statuses' {
        $tmp = Join-Path $pluginRoot 'tmp/pester-semantic-escape'
        $model = Join-Path $tmp 'model'
        New-Item -ItemType Directory -Force -Path $model | Out-Null
        @'
MEASURE 'Odd Table'[Gross "Sales"] = SUM('Odd Table'[Amount])
MEASURE 'Odd Table'[Margin Check] = 1
'@ | Set-Content -LiteralPath (Join-Path $model 'Odd.Measures.dax') -Encoding UTF8

        $expectationsPath = Join-Path $tmp 'measure-expectations.json'
        [pscustomobject]@{
            schema = 'codex.powerbi.measureExpectations.v1'
            expectations = @(
                [pscustomobject]@{ measure = 'Gross "Sales"'; expected = $null; tolerance = 0; filters = [pscustomobject]@{}; existsOnly = $true },
                [pscustomobject]@{ measure = 'Margin Check'; expected = 1; tolerance = 0; filters = [pscustomobject]@{} }
            )
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $expectationsPath -Encoding UTF8

        $result = & (Join-Path $scriptsPath 'Test-PowerBIMeasureExpectations.ps1') -Path $model -ExpectationsPath $expectationsPath -Json | ConvertFrom-Json
        $generated = & (Join-Path $scriptsPath 'Test-PowerBIMeasureExpectations.ps1') -Path $model -ExpectationsPath $expectationsPath -GenerateOnly -Json | ConvertFrom-Json

        @($result.checks | Where-Object { $_.measure -eq 'Gross "Sales"' })[0].status | Should Be 'ExistsOnly'
        @($result.checks | Where-Object { $_.measure -eq 'Margin Check' })[0].status | Should Be 'PendingLiveDax'
        @($generated.checks | Where-Object { $_.measure -eq 'Margin Check' })[0].status | Should Be 'QueryGenerated'
        @($generated.checks | Where-Object { $_.measure -eq 'Gross "Sales"' })[0].daxQuery | Should Match 'Gross ""Sales""'
        @($generated.checks | Where-Object { $_.measure -eq 'Margin Check' })[0].daxQuery | Should Match '\[Margin Check\]'
    }

    It 'compares baseline and current measure result files with tolerance' {
        $tmp = Join-Path $pluginRoot 'tmp/pester-behavior'
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        $baselinePath = Join-Path $tmp 'baseline.json'
        $currentPath = Join-Path $tmp 'current.json'
        [pscustomobject]@{
            checks = @(
                [pscustomobject]@{ measure = 'Total Sales'; actual = 100.0; tolerance = 0.5; filters = [pscustomobject]@{ 'Sales.Region' = 'West' } },
                [pscustomobject]@{ measure = 'Gross Margin %'; actual = 0.4; tolerance = 0.01; filters = [pscustomobject]@{} }
            )
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $baselinePath -Encoding UTF8
        [pscustomobject]@{
            checks = @(
                [pscustomobject]@{ measure = 'Total Sales'; actual = 100.4; tolerance = 0.5; filters = [pscustomobject]@{ 'Sales.Region' = 'West' } },
                [pscustomobject]@{ measure = 'Gross Margin %'; actual = 0.5; tolerance = 0.01; filters = [pscustomobject]@{} }
            )
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $currentPath -Encoding UTF8

        $result = & (Join-Path $scriptsPath 'Compare-PowerBIMeasureBehavior.ps1') -BaselineResultsPath $baselinePath -CurrentResultsPath $currentPath -Json | ConvertFrom-Json

        $result.status | Should Be 'Failed'
        $result.comparisonCount | Should Be 2
        @($result.comparisons | Where-Object { $_.measure -eq 'Total Sales' })[0].status | Should Be 'Passed'
        @($result.comparisons | Where-Object { $_.measure -eq 'Gross Margin %' })[0].status | Should Be 'Failed'
    }

    It 'returns a deterministic behavior comparison plan without live servers' {
        $tmp = Join-Path $pluginRoot 'tmp/pester-behavior-plan'
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        $expectationsPath = Join-Path $tmp 'measure-expectations.json'
        [pscustomobject]@{
            schema = 'codex.powerbi.measureExpectations.v1'
            expectations = @(
                [pscustomobject]@{ measure = 'Total Sales'; expected = 100; tolerance = 1; filters = [pscustomobject]@{} }
            )
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $expectationsPath -Encoding UTF8

        $result = & (Join-Path $scriptsPath 'Compare-PowerBIMeasureBehavior.ps1') -Path $samplePath -ExpectationsPath $expectationsPath -Json | ConvertFrom-Json

        $result.status | Should Be 'NotAvailable'
        $result.notAvailableCount | Should Be 1
        $result.comparisons[0].status | Should Be 'NotAvailable'
        $result.comparisons[0].daxQuery | Should Match 'EVALUATE ROW'
    }

    It 'creates autonomous QA Lab packages with pending checks' {
        $qa = & (Join-Path $scriptsPath 'New-PowerBIAutonomousQALab.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-qa-lab') -Json | ConvertFrom-Json
        $strict = & (Join-Path $scriptsPath 'New-PowerBIAutonomousQALab.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-qa-lab-strict') -FailOnPending -Json | ConvertFrom-Json

        $qa.schema | Should Be 'codex.powerbi.autonomousQALab.v1'
        $qa.qaQuestionCount | Should Be 5
        $qa.pendingCount | Should Be 0
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-qa-lab/generated-questions.json')) | Should Be $true
        $strict.schema | Should Be 'codex.powerbi.autonomousQALab.v1'
        (@('Low','Medium','High') -contains $strict.releaseRisk) | Should Be $true
    }
}
