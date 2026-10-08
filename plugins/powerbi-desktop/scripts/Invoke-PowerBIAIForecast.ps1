param(
    [string]$Server,
    [string]$InputPath,
    [string]$OutputDirectory = (Join-Path (Get-Location) 'powerbi-ai-forecast'),
    [datetime]$AsOfDate,
    [int]$ForecastYear = 2026,
    [int]$StartMonth = 5,
    [int]$EndMonth = 12,
    [int]$HorizonMonths = 3,
    [ValidateSet('CustomerProduct', 'HierarchyProductLine')]
    [string]$Grain = 'CustomerProduct',
    [switch]$Backtest,
    [switch]$DryRun,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$asOfDateProvided = $PSBoundParameters.ContainsKey('AsOfDate')
$endMonthProvided = $PSBoundParameters.ContainsKey('EndMonth')

function ConvertTo-OutputJson {
    param([Parameter(Mandatory = $true)]$InputObject)

    $InputObject | ConvertTo-Json -Depth 12
}

function Find-PythonExecutable {
    $commands = @('python', 'py')
    foreach ($command in $commands) {
        if (Get-Command $command -ErrorAction SilentlyContinue) {
            return $command
        }
    }
    throw 'Python was not found on PATH. Install Python 3 or add it to PATH, then retry.'
}

if ($StartMonth -lt 1 -or $StartMonth -gt 12) {
    throw 'StartMonth must be between 1 and 12.'
}
if ($HorizonMonths -lt 1 -or $HorizonMonths -gt 12) {
    throw 'HorizonMonths must be between 1 and 12.'
}
if (-not $endMonthProvided) {
    $EndMonth = [Math]::Min(12, $StartMonth + $HorizonMonths - 1)
}
if ($EndMonth -lt 1 -or $EndMonth -gt 12) {
    throw 'EndMonth must be between 1 and 12.'
}
if ($StartMonth -gt $EndMonth) {
    throw 'StartMonth must be less than or equal to EndMonth.'
}

if (-not $asOfDateProvided) {
    $AsOfDate = [datetime]::new($ForecastYear, $StartMonth, 1).AddMonths(1).AddDays(-1)
}

$fromYear = $ForecastYear - 5
function New-SalesHistoryQuery {
    param([ValidateSet('CustomerProduct', 'HierarchyProductLine')][string]$QueryGrain)

    $grainColumns = if ($QueryGrain -eq 'CustomerProduct') {
@"
        'dw Custtable'[AccountNum_sk],
        'dw Custtable'[AccountNum_nk],
        'dw Inventtable'[ItemId_sk],
        'dw Inventtable'[ItemId_nk],
"@
    }
    else {
        ''
    }

@"
EVALUATE
FILTER(
    SUMMARIZECOLUMNS(
        $grainColumns
        'dw Custtable'[CustHierachy01],
        'dw Inventtable'[ProductLineHerachy01],
        'Dates'[Calendar Year],
        'Dates'[Calendar MonthNumber],
        'Dates'[Calendar Month Year],
        FILTER(
            ALL('Dates'[Calendar Year]),
            'Dates'[Calendar Year] >= $fromYear
                && 'Dates'[Calendar Year] <= $ForecastYear
        ),
        "MonthStart", MIN('Dates'[Date]),
        "Sales", [_SumSalesTotal],
        "Qty", [_SumQTY],
        "Budget", [_SumBudgetAmount],
        "ForecastRoll", [_SumForecastAmountRoll],
        "Backlog", [_BacklogAmountMst]
    ),
    NOT (ISBLANK([Sales]))
        || NOT (ISBLANK([Qty]))
        || NOT (ISBLANK([Budget]))
        || NOT (ISBLANK([ForecastRoll]))
        || NOT (ISBLANK([Backlog]))
)
ORDER BY
    'dw Custtable'[CustHierachy01],
    'dw Inventtable'[ProductLineHerachy01],
    'Dates'[Calendar Year],
    'Dates'[Calendar MonthNumber]
"@
}

$salesHistoryQuery = New-SalesHistoryQuery -QueryGrain $Grain
$effectiveGrain = $Grain
$grainFallbackReason = $null

$backlogDetailQuery = @"
EVALUATE
SUMMARIZECOLUMNS(
    'scm Salesline'[Auftragsnummer],
    'scm Salesline'[Positionsnummer],
    'scm Salesline'[Auftragspositionsstatus],
    'scm Salesline'[ABMenge],
    'scm Salesline'[ABWert in EUR],
    'scm Salesline'[MengeBestellt],
    'scm Salesline'[Wert in EUR],
    'scm Salesline'[Accountnum],
    'scm Salesline'[Geplantes Positionslieferdatum],
    'scm Salesline'[Angefordertes Positionslieferdatum],
    'scm Salesline'[Auftragseingangsdatum],
    'scm Salesline'[OrderDate],
    'scm Salesline'[IsBacklog],
    'scm Salesline'[InventDimSK]
)
"@

$budgetRollQuery = @"
EVALUATE
FILTER(
    SUMMARIZECOLUMNS(
        'Dates'[Calendar Year],
        'Dates'[Calendar MonthNumber],
        "Budget", [_SumBudgetAmount],
        "ForecastRoll", [_SumForecastAmountRoll]
    ),
    'Dates'[Calendar Year] >= $fromYear && 'Dates'[Calendar Year] <= $ForecastYear
)
"@

$dateFeaturesQuery = @"
EVALUATE
FILTER(
    SUMMARIZECOLUMNS(
        'Dates'[Date],
        'Dates'[Calendar Year],
        'Dates'[Calendar MonthNumber],
        'Dates'[IsWorkingDay],
        'Dates'[IsWeekend],
        'Dates'[IsHoliday]
    ),
    'Dates'[Calendar Year] >= $fromYear && 'Dates'[Calendar Year] <= $ForecastYear
)
"@

$plan = [pscustomobject]@{
    schema = 'codex.powerbi.aiForecast.plan.v1'
    forecastYear = $ForecastYear
    startMonth = $StartMonth
    endMonth = $EndMonth
    asOfDate = $AsOfDate.ToString('yyyy-MM-dd')
    horizonMonths = $HorizonMonths
    grain = $Grain
    effectiveGrain = $effectiveGrain
    outputDirectory = $OutputDirectory
    queries = [pscustomobject]@{
        segmentMonthly = $salesHistoryQuery
        salesHistory = $salesHistoryQuery
        backlogDetail = $backlogDetailQuery
        budgetRoll = $budgetRollQuery
        dateFeatures = $dateFeaturesQuery
    }
}

if ($DryRun) {
    if ($Json) {
        ConvertTo-OutputJson -InputObject $plan
        return
    }
    return $plan
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

if (-not $InputPath) {
    $liveDaxScript = Join-Path $PSScriptRoot 'Invoke-PowerBILiveDaxQuery.ps1'
    if (-not $asOfDateProvided) {
        $asOfQuery = @"
EVALUATE
ROW(
    "AsOfDate",
    CALCULATE(
        MAX('dw FactInvoice'[InvoiceDate_nk]),
        'dw FactInvoice'[Rechnung_fakturiert] = 1
    )
)
"@
        $asOfArgs = @{
            Query = $asOfQuery
            Json = $true
        }
        if ($Server) {
            $asOfArgs.Server = $Server
        }
        $asOfJson = & $liveDaxScript @asOfArgs
        if ($LASTEXITCODE) {
            exit $LASTEXITCODE
        }
        $asOfResult = $asOfJson | ConvertFrom-Json
        if ($asOfResult.rows.Count -gt 0 -and $asOfResult.rows[0].'[AsOfDate]') {
            $AsOfDate = [datetime]$asOfResult.rows[0].'[AsOfDate]'
        }
    }

    $liveArgs = @{
        Query = $salesHistoryQuery
        Json = $true
    }
    if ($Server) {
        $liveArgs.Server = $Server
    }

    try {
        $segmentJson = & $liveDaxScript @liveArgs
        if ($LASTEXITCODE) {
            exit $LASTEXITCODE
        }
    }
    catch {
        if ($Grain -ne 'CustomerProduct') {
            throw
        }
        $effectiveGrain = 'HierarchyProductLine'
        $grainFallbackReason = "CustomerProduct live extract failed: $($_.Exception.Message)"
        $salesHistoryQuery = New-SalesHistoryQuery -QueryGrain $effectiveGrain
        $liveArgs.Query = $salesHistoryQuery
        $segmentJson = & $liveDaxScript @liveArgs
        if ($LASTEXITCODE) {
            exit $LASTEXITCODE
        }
    }

    $InputPath = Join-Path $OutputDirectory 'segment-monthly.json'
    $segmentJson | Set-Content -LiteralPath $InputPath -Encoding UTF8
}

$resolvedInputPath = Resolve-Path -LiteralPath $InputPath
$workerPath = Join-Path $PSScriptRoot 'support/powerbi_ai_forecast.py'
$python = Find-PythonExecutable
$pythonArgs = @()
if ($python -eq 'py') {
    $pythonArgs += '-3'
}
$pythonArgs += @(
    $workerPath,
    '--input', $resolvedInputPath.Path,
    '--output-directory', $OutputDirectory,
    '--as-of-date', $AsOfDate.ToString('yyyy-MM-dd'),
    '--forecast-year', $ForecastYear,
    '--start-month', $StartMonth,
    '--end-month', $EndMonth,
    '--horizon-months', $HorizonMonths,
    '--grain', $effectiveGrain
)
if ($Backtest) {
    $pythonArgs += '--backtest'
}

$workerJson = & $python @pythonArgs
if ($LASTEXITCODE) {
    exit $LASTEXITCODE
}

$result = $workerJson | ConvertFrom-Json
$result | Add-Member -NotePropertyName inputPath -NotePropertyValue $resolvedInputPath.Path -Force
$result | Add-Member -NotePropertyName requestedGrain -NotePropertyValue $Grain -Force
$result | Add-Member -NotePropertyName effectiveGrain -NotePropertyValue $effectiveGrain -Force
if ($grainFallbackReason) {
    $result | Add-Member -NotePropertyName grainFallbackReason -NotePropertyValue $grainFallbackReason -Force
}

if ($Json) {
    ConvertTo-OutputJson -InputObject $result
    return
}

$result
