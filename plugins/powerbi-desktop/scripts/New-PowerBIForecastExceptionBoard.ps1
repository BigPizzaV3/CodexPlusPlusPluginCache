param(
    [string]$Path = ".",
    [string]$ForecastDirectory,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Path).Path
if ($ForecastDirectory) {
    $forecastRoot = (Resolve-Path -LiteralPath $ForecastDirectory).Path
}
else {
    $directSummary = Join-Path $root 'ai-forecast-summary.csv'
    if (Test-Path -LiteralPath $directSummary) {
        $forecastRoot = $root
    }
    else {
        $candidate = Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'ai-forecast-summary.csv' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1
        $forecastRoot = if ($candidate) { $candidate.Directory.FullName } else { $root }
    }
}

function Read-ForecastCsv {
    param([string]$FilePath)

    if (-not (Test-Path -LiteralPath $FilePath)) { return @() }
    $firstLine = Get-Content -LiteralPath $FilePath -TotalCount 1
    $delimiter = if ($firstLine -match ';') { ';' } else { ',' }
    @(Import-Csv -LiteralPath $FilePath -Delimiter $delimiter)
}

function ConvertTo-Number {
    param($Value)

    if ($null -eq $Value -or $Value -eq '') { return 0.0 }
    $text = [string]$Value
    $number = 0.0
    if ([double]::TryParse($text, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        return $number
    }
    if ([double]::TryParse($text, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::CurrentCulture, [ref]$number)) {
        return $number
    }
    0.0
}

function Get-PropertyValue {
    param($Row, [string[]]$Names)

    foreach ($name in $Names) {
        if ($Row.PSObject.Properties.Name -contains $name) {
            return $Row.$name
        }
    }
    $null
}

function New-Exception {
    param(
        [string]$Id,
        [string]$Type,
        [string]$Title,
        [string]$OwnerHint,
        [double]$Impact,
        [string]$Action,
        [string]$DueWindow,
        [string[]]$ClosureEvidenceRequired,
        [string]$Status,
        [object]$Evidence
    )

    [pscustomobject]@{
        id = $Id
        type = $Type
        title = $Title
        ownerHint = $OwnerHint
        impact = [math]::Round($Impact, 2)
        action = $Action
        dueWindow = $DueWindow
        closureEvidenceRequired = @($ClosureEvidenceRequired)
        status = $Status
        evidence = $Evidence
    }
}

$summaryPath = Join-Path $forecastRoot 'ai-forecast-summary.csv'
$topDeltasPath = Join-Path $forecastRoot 'ai-forecast-top-deltas.csv'
$qualityPath = Join-Path $forecastRoot 'ai-forecast-model-quality.csv'

$summaryRows = @(Read-ForecastCsv -FilePath $summaryPath)
$topDeltaRows = @(Read-ForecastCsv -FilePath $topDeltasPath)
$qualityRows = @(Read-ForecastCsv -FilePath $qualityPath)
$availableFiles = @($summaryPath, $topDeltasPath, $qualityPath | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Split-Path -Leaf $_ })
$exceptions = New-Object System.Collections.Generic.List[object]

if ($summaryRows.Count -gt 0) {
    foreach ($row in $summaryRows) {
        $month = Get-PropertyValue -Row $row -Names @('forecast_month', 'month')
        $deltaRoll = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('delta_ai_vs_roll', 'delta_reconciled_vs_roll'))
        $deltaBudget = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('delta_ai_vs_budget', 'delta_vs_budget'))
        $finalForecast = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('final_ai_forecast', 'reconciled_forecast', 'recommended_forecast'))
        $roll = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('roll_forecast'))
        $budget = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('budget'))
        $largestDelta = [math]::Max([math]::Abs($deltaRoll), [math]::Abs($deltaBudget))
        $denominator = [math]::Max(1.0, [math]::Max([math]::Abs($roll), [math]::Abs($budget)))
        $relativeDelta = $largestDelta / $denominator
        if ($relativeDelta -ge 0.08 -or $largestDelta -ge 500000) {
            $exceptions.Add((New-Exception `
                -Id ('summary-{0}' -f (($month -replace '[^A-Za-z0-9]+', '-').Trim('-')).ToLowerInvariant()) `
                -Type 'MonthlyVariance' `
                -Title ("Monthly forecast variance requires review: {0}" -f $month) `
                -OwnerHint 'Sales planning / finance forecast owner' `
                -Impact $largestDelta `
                -Action 'Reconcile AI forecast against roll forecast, budget, known backlog timing, and commercial plan changes.' `
                -DueWindow 'Before next forecast sign-off' `
                -ClosureEvidenceRequired @('Approved monthly variance note', 'Updated forecast bridge or accepted roll/budget override') `
                -Status 'Open' `
                -Evidence ([pscustomobject]@{
                    month = $month
                    finalAiForecast = [math]::Round($finalForecast, 2)
                    rollForecast = [math]::Round($roll, 2)
                    budget = [math]::Round($budget, 2)
                    deltaAiVsRoll = [math]::Round($deltaRoll, 2)
                    deltaAiVsBudget = [math]::Round($deltaBudget, 2)
                    relativeDelta = [math]::Round($relativeDelta, 4)
                })))
        }
    }
}

$topDeltaLimit = [math]::Min(10, $topDeltaRows.Count)
for ($index = 0; $index -lt $topDeltaLimit; $index++) {
    $row = $topDeltaRows[$index]
    $customer = Get-PropertyValue -Row $row -Names @('customer', 'customer_hierarchy')
    $product = Get-PropertyValue -Row $row -Names @('product', 'product_line')
    $month = Get-PropertyValue -Row $row -Names @('forecast_month', 'month')
    $finalForecast = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('final_ai_forecast', 'reconciled_forecast', 'recommended_forecast'))
    $roll = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('roll_forecast'))
    $low = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('forecast_low'))
    $high = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('forecast_high'))
    $impact = [math]::Abs($finalForecast - $roll)
    $riskFlag = Get-PropertyValue -Row $row -Names @('risk_flag')
    $confidence = Get-PropertyValue -Row $row -Names @('confidence')
    $exceptions.Add((New-Exception `
        -Id ('segment-{0}-{1}' -f ($index + 1), (($month + '-' + $customer + '-' + $product) -replace '[^A-Za-z0-9]+', '-').Trim('-')).ToLowerInvariant() `
        -Type 'SegmentDelta' `
        -Title ("Top segment delta: {0} / {1} / {2}" -f $month, $customer, $product) `
        -OwnerHint 'Account owner with product-line controller' `
        -Impact $impact `
        -Action 'Validate demand signal, backlog conversion assumption, and customer/product event drivers before accepting the AI forecast.' `
        -DueWindow 'Within 5 business days' `
        -ClosureEvidenceRequired @('Account-level explanation', 'Accepted forecast value or corrected source input', 'Controller sign-off for material deltas') `
        -Status 'Open' `
        -Evidence ([pscustomobject]@{
            month = $month
            customer = $customer
            product = $product
            finalAiForecast = [math]::Round($finalForecast, 2)
            rollForecast = [math]::Round($roll, 2)
            forecastLow = [math]::Round($low, 2)
            forecastHigh = [math]::Round($high, 2)
            confidence = $confidence
            riskFlag = $riskFlag
        })))
}

foreach ($row in $qualityRows) {
    $riskFlag = Get-PropertyValue -Row $row -Names @('risk_flag')
    $wape = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('wape'))
    $rollWape = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('roll_wape'))
    $bias = ConvertTo-Number (Get-PropertyValue -Row $row -Names @('bias'))
    if ($riskFlag -and $riskFlag -ne 'normal' -or $wape -gt 0.35 -or [math]::Abs($bias) -gt 0.2) {
        $horizon = Get-PropertyValue -Row $row -Names @('horizon_months')
        $segment = Get-PropertyValue -Row $row -Names @('segment')
        $exceptions.Add((New-Exception `
            -Id ('quality-{0}-{1}' -f $horizon, (($segment -replace '[^A-Za-z0-9]+', '-').Trim('-')).ToLowerInvariant()) `
            -Type 'ModelQuality' `
            -Title ("Forecast quality gate requires review: horizon {0}, {1}" -f $horizon, $segment) `
            -OwnerHint 'Forecast analytics owner' `
            -Impact ([math]::Max($wape, [math]::Abs($bias)) * 100) `
            -Action 'Review backtest error, bias, and roll forecast comparison before using this horizon for management decisions.' `
            -DueWindow 'Before board publication' `
            -ClosureEvidenceRequired @('Backtest quality note', 'Bias mitigation or documented advisory-only decision') `
            -Status 'Open' `
            -Evidence ([pscustomobject]@{
                horizonMonths = $horizon
                segment = $segment
                wape = [math]::Round($wape, 4)
                rollWape = [math]::Round($rollWape, 4)
                bias = [math]::Round($bias, 4)
                riskFlag = $riskFlag
            })))
    }
}

$status = if ($availableFiles.Count -eq 0) { 'NeedsData' } elseif ($exceptions.Count -eq 0) { 'Empty' } else { 'Open' }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.forecastExceptionBoard.v1'
    root = $root
    forecastDirectory = $forecastRoot
    generated = (Get-Date).ToString('s')
    status = $status
    availableFiles = @($availableFiles)
    missingFiles = @(
        if (-not (Test-Path -LiteralPath $summaryPath)) { 'ai-forecast-summary.csv' }
        if (-not (Test-Path -LiteralPath $topDeltasPath)) { 'ai-forecast-top-deltas.csv' }
        if (-not (Test-Path -LiteralPath $qualityPath)) { 'ai-forecast-model-quality.csv' }
    )
    exceptionCount = $exceptions.Count
    exceptions = @($exceptions | Sort-Object @{ Expression = { $_.impact }; Descending = $true })
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Forecast Exception Board')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $result.schema))
$lines.Add(('Forecast directory: `{0}`' -f $result.forecastDirectory))
$lines.Add(('Generated: {0}' -f $result.generated))
$lines.Add(('Status: {0}' -f $result.status))
$lines.Add(('Exceptions: {0}' -f $result.exceptionCount))
$lines.Add('')
if ($result.status -eq 'NeedsData') {
    $lines.Add('No forecast CSV files were found. Generate or provide `ai-forecast-summary.csv`, `ai-forecast-top-deltas.csv`, and `ai-forecast-model-quality.csv`.')
}
elseif ($result.exceptionCount -eq 0) {
    $lines.Add('No forecast exceptions were generated from the available forecast files.')
}
foreach ($exception in $result.exceptions) {
    $lines.Add(('## {0}' -f $exception.title))
    $lines.Add('')
    $lines.Add(('- Status: {0}' -f $exception.status))
    $lines.Add(('- Type: {0}' -f $exception.type))
    $lines.Add(('- Owner hint: {0}' -f $exception.ownerHint))
    $lines.Add(('- Impact: {0}' -f $exception.impact))
    $lines.Add(('- Due window: {0}' -f $exception.dueWindow))
    $lines.Add(('- Action: {0}' -f $exception.action))
    $lines.Add(('- Closure evidence required: {0}' -f ($exception.closureEvidenceRequired -join '; ')))
    $lines.Add('')
}

$markdown = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8 }
$markdown
