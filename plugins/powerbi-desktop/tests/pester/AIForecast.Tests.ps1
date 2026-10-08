$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'
$fixturePath = Join-Path $pluginRoot 'examples/ai-forecast/segment-monthly.json'
$outputPath = Join-Path $pluginRoot 'tmp/pester-ai-forecast'

Describe 'Power BI AI forecast' {
    It 'runs forecast from fixture input and writes detail output' {
        $forecast = & (Join-Path $scriptsPath 'Invoke-PowerBIAIForecast.ps1') -InputPath $fixturePath -OutputDirectory $outputPath -StartMonth 5 -EndMonth 6 -Backtest -Json | ConvertFrom-Json

        $forecast.schema | Should Be 'codex.powerbi.aiForecast.v1'
        ($forecast.rowCount -gt 0) | Should Be $true
        (Test-Path -LiteralPath $forecast.detailPath) | Should Be $true
        ([string]::IsNullOrWhiteSpace($forecast.summaryPath)) | Should Be $false
        ([string]::IsNullOrWhiteSpace($forecast.topDeltaPath)) | Should Be $false
        (Test-Path -LiteralPath $forecast.summaryPath) | Should Be $true
        (Test-Path -LiteralPath $forecast.topDeltaPath) | Should Be $true
        $summaryRows = Import-Csv -LiteralPath $forecast.summaryPath -Delimiter ';'
        $summaryRows.Count | Should Be 2
        ([string]::IsNullOrWhiteSpace($forecast.backtestPath)) | Should Be $false
        ([string]::IsNullOrWhiteSpace($forecast.modelQualityPath)) | Should Be $false
        (Test-Path -LiteralPath $forecast.backtestPath) | Should Be $true
        (Test-Path -LiteralPath $forecast.modelQualityPath) | Should Be $true
        $detailRows = Import-Csv -LiteralPath $forecast.detailPath -Delimiter ';'
        $detailColumns = @($detailRows[0].PSObject.Properties.Name)
        ($detailColumns -contains 'as_of_date') | Should Be $true
        ($detailColumns -contains 'forecast_month') | Should Be $true
        ($detailColumns -contains 'grain') | Should Be $true
        ($detailColumns -contains 'residual_demand_forecast') | Should Be $true
        ($detailColumns -contains 'backlog_conversion_probability') | Should Be $true
        ($detailRows | Where-Object { $_.forecast_month -eq 'May 2026' -and [double]$_.final_ai_forecast -gt 0 }).Count | Should BeGreaterThan 0
    }

    It 'returns the DAX query plan in dry-run mode' {
        $plan = & (Join-Path $scriptsPath 'Invoke-PowerBIAIForecast.ps1') -DryRun -Grain CustomerProduct -HorizonMonths 3 -Json | ConvertFrom-Json

        $plan.schema | Should Be 'codex.powerbi.aiForecast.plan.v1'
        $plan.grain | Should Be 'CustomerProduct'
        $plan.horizonMonths | Should Be 3
        $plan.queries.salesHistory | Should Match 'SUMMARIZECOLUMNS'
        $plan.queries.salesHistory | Should Match 'dw Custtable'
        $plan.queries.salesHistory | Should Match 'dw Inventtable'
        $plan.queries.backlogDetail | Should Match 'scm Salesline'
        $plan.queries.budgetRoll | Should Match 'ForecastRoll'
        $plan.queries.dateFeatures | Should Match 'Dates'
    }

    It 'creates quality metrics and non-empty horizon forecasts for May through July' {
        $forecast = & (Join-Path $scriptsPath 'Invoke-PowerBIAIForecast.ps1') -InputPath $fixturePath -OutputDirectory $outputPath -AsOfDate '2026-05-08' -HorizonMonths 3 -Grain CustomerProduct -Backtest -Json | ConvertFrom-Json

        $summaryRows = Import-Csv -LiteralPath $forecast.summaryPath -Delimiter ';'
        @('May 2026', 'Jun 2026', 'Jul 2026') | ForEach-Object {
            $expectedMonth = $_
            $row = $summaryRows | Where-Object { $_.forecast_month -eq $expectedMonth -or $_.month -eq $expectedMonth } | Select-Object -First 1
            $row | Should Not BeNullOrEmpty
            ([double]$row.final_ai_forecast -gt 0) | Should Be $true
        }

        $qualityRows = Import-Csv -LiteralPath $forecast.modelQualityPath -Delimiter ';'
        $qualityColumns = @($qualityRows[0].PSObject.Properties.Name)
        ($qualityColumns -contains 'wape') | Should Be $true
        ($qualityColumns -contains 'bias') | Should Be $true
        ($qualityColumns -contains 'horizon_months') | Should Be $true
    }
}
