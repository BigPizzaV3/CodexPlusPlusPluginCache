param(
    [string]$Path = ".",
    [ValidateSet('All','OrderToCash','ProcureToPay','RecordToReport','HireToRetire','PlanToProduce','ForecastToDeliver','ServiceToCash','IssueToResolution','LeadToOpportunity','QuoteToOrder')]
    [string]$ProcessPack = 'All',
    [string]$DataPath,
    [string]$MappingPath,
    [string]$OutputDirectory = "powerbi-business-process-dq",
    [switch]$Json,
    [switch]$FailOnHigh
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Split-Path -Parent $scriptRoot
$rulesRoot = Join-Path $pluginRoot 'rules/process-packs'
$root = (Resolve-Path -LiteralPath $Path).Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

$packNameMap = @{
    OrderToCash = 'order-to-cash'
    ProcureToPay = 'procure-to-pay'
    RecordToReport = 'record-to-report'
    HireToRetire = 'hire-to-retire'
    PlanToProduce = 'plan-to-produce'
    ForecastToDeliver = 'forecast-to-deliver'
    ServiceToCash = 'service-to-cash'
    IssueToResolution = 'issue-to-resolution'
    LeadToOpportunity = 'lead-to-opportunity'
    QuoteToOrder = 'quote-to-order'
}

function Read-DataTables {
    param([string]$Folder)
    $tables = @{}
    if (-not $Folder -or -not (Test-Path -LiteralPath $Folder)) { return $tables }
    Get-ChildItem -LiteralPath $Folder -File -Include *.csv,*.json -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $rows = @()
        try {
            if ($_.Extension -ieq '.csv') { $rows = @(Import-Csv -LiteralPath $_.FullName) }
            elseif ($_.Extension -ieq '.json') {
                $raw = Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json
                $rows = if ($raw -is [array]) { @($raw) } elseif ($raw.rows) { @($raw.rows) } else { @($raw) }
            }
        }
        catch { $rows = @() }
        $tables[$_.BaseName] = [pscustomobject]@{ name = $_.BaseName; path = $_.FullName; rows = @($rows); columns = if ($rows.Count -gt 0) { @($rows[0].PSObject.Properties.Name) } else { @() } }
    }
    $tables
}

function Get-PropertyValue {
    param([object]$Row, [string]$Name)
    if (-not $Row -or -not $Name) { return $null }
    $prop = @($Row.PSObject.Properties | Where-Object { $_.Name -ieq $Name } | Select-Object -First 1)
    if ($prop) { $prop[0].Value } else { $null }
}

function Test-Blank {
    param([object]$Value)
    $null -eq $Value -or [string]::IsNullOrWhiteSpace($Value.ToString())
}

function Convert-ToDecimal {
    param([object]$Value)
    if (Test-Blank $Value) { return $null }
    $text = $Value.ToString().Replace(',', '.')
    $number = 0.0
    if ([double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) { return $number }
    $null
}

function Convert-ToDate {
    param([object]$Value)
    if (Test-Blank $Value) { return $null }
    $date = [datetime]::MinValue
    if ([datetime]::TryParse($Value.ToString(), [ref]$date)) { return $date }
    $null
}

function New-Finding {
    param([object]$Pack, [object]$Rule, [string]$Evidence, [int]$Count, [string[]]$AffectedKpis)
    [pscustomobject]@{
        ruleId = $Rule.id
        process = $Pack.process
        severity = $Rule.severity
        object = $Rule.object
        field = $Rule.field
        finding = $Rule.description
        evidence = $Evidence
        affectedKpis = @($AffectedKpis)
        ownerHint = $Rule.ownerHint
        recommendedAction = $Rule.recommendedAction
        releaseImpact = $Rule.releaseImpact
        count = $Count
    }
}

function Get-ObjectMapping {
    param([object]$Mapping, [string]$Process, [string]$Object)
    @($Mapping.mappings | Where-Object { $_.process -eq $Process -and $_.object -eq $Object } | Select-Object -First 1)
}

function Get-MappedField {
    param([object]$ObjectMapping, [string]$Field)
    $hit = @($ObjectMapping.fields | Where-Object { $_.name -eq $Field } | Select-Object -First 1)
    if ($hit) { $hit[0].mappedField } else { $null }
}

function Get-TableRowsForObject {
    param([object]$ObjectMapping, [hashtable]$Tables)
    if (-not $ObjectMapping -or -not $ObjectMapping.mappedTable) { return @() }
    if ($Tables.ContainsKey($ObjectMapping.mappedTable)) { return @($Tables[$ObjectMapping.mappedTable].rows) }
    @()
}

function Invoke-Rule {
    param([object]$Pack, [object]$Rule, [object]$Mapping, [hashtable]$Tables, [string[]]$AffectedKpis)
    $objectMapping = Get-ObjectMapping -Mapping $Mapping -Process $Pack.process -Object $Rule.object
    if (-not $objectMapping -or $objectMapping.status -eq 'MissingObject') {
        if ($Rule.type -eq 'requiredField') {
            return New-Finding -Pack $Pack -Rule $Rule -Evidence "Object $($Rule.object) is not mapped." -Count 1 -AffectedKpis $AffectedKpis
        }
        return $null
    }
    $rows = @(Get-TableRowsForObject -ObjectMapping $objectMapping -Tables $Tables)
    $field = Get-MappedField -ObjectMapping $objectMapping -Field $Rule.field
    switch ($Rule.type) {
        'requiredField' {
            if (-not $field) { return New-Finding -Pack $Pack -Rule $Rule -Evidence "Required field $($Rule.field) is not mapped." -Count 1 -AffectedKpis $AffectedKpis }
            if ($rows.Count -eq 0) { return $null }
            $bad = @($rows | Where-Object { Test-Blank (Get-PropertyValue -Row $_ -Name $field) })
            if ($bad.Count -gt 0) { return New-Finding -Pack $Pack -Rule $Rule -Evidence "$($bad.Count) rows have blank $field." -Count $bad.Count -AffectedKpis $AffectedKpis }
        }
        'nonNegative' {
            if (-not $field -or $rows.Count -eq 0) { return $null }
            $bad = @($rows | Where-Object { $n = Convert-ToDecimal (Get-PropertyValue -Row $_ -Name $field); $null -ne $n -and $n -lt 0 })
            if ($bad.Count -gt 0) { return New-Finding -Pack $Pack -Rule $Rule -Evidence "$($bad.Count) rows have negative $field." -Count $bad.Count -AffectedKpis $AffectedKpis }
        }
        'dateOrder' {
            $startField = Get-MappedField -ObjectMapping $objectMapping -Field $Rule.startField
            $endField = Get-MappedField -ObjectMapping $objectMapping -Field $Rule.endField
            if (-not $startField -or -not $endField -or $rows.Count -eq 0) { return $null }
            $bad = @($rows | Where-Object {
                $start = Convert-ToDate (Get-PropertyValue -Row $_ -Name $startField)
                $end = Convert-ToDate (Get-PropertyValue -Row $_ -Name $endField)
                $start -and $end -and $end -lt $start
            })
            if ($bad.Count -gt 0) { return New-Finding -Pack $Pack -Rule $Rule -Evidence "$($bad.Count) rows have $endField before $startField." -Count $bad.Count -AffectedKpis $AffectedKpis }
        }
        'orphan' {
            $childField = Get-MappedField -ObjectMapping $objectMapping -Field $Rule.field
            $parentMapping = Get-ObjectMapping -Mapping $Mapping -Process $Pack.process -Object $Rule.parentObject
            $parentField = if ($parentMapping) { Get-MappedField -ObjectMapping $parentMapping -Field $Rule.parentField } else { $null }
            $parentRows = @(Get-TableRowsForObject -ObjectMapping $parentMapping -Tables $Tables)
            if (-not $childField -or -not $parentField -or $rows.Count -eq 0 -or $parentRows.Count -eq 0) { return $null }
            $parentKeys = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
            foreach ($row in $parentRows) {
                $value = Get-PropertyValue -Row $row -Name $parentField
                if (-not (Test-Blank $value)) { [void]$parentKeys.Add($value.ToString()) }
            }
            $bad = @($rows | Where-Object { $v = Get-PropertyValue -Row $_ -Name $childField; -not (Test-Blank $v) -and -not $parentKeys.Contains($v.ToString()) })
            if ($bad.Count -gt 0) { return New-Finding -Pack $Pack -Rule $Rule -Evidence "$($bad.Count) child rows reference missing $($Rule.parentObject)." -Count $bad.Count -AffectedKpis $AffectedKpis }
        }
        'overdueOpen' {
            $dueField = Get-MappedField -ObjectMapping $objectMapping -Field $Rule.field
            $statusField = Get-MappedField -ObjectMapping $objectMapping -Field $Rule.statusField
            if (-not $dueField -or -not $statusField -or $rows.Count -eq 0) { return $null }
            $closed = @($Rule.closedValues | ForEach-Object { $_.ToString() })
            $today = (Get-Date).Date
            $bad = @($rows | Where-Object {
                $due = Convert-ToDate (Get-PropertyValue -Row $_ -Name $dueField)
                $status = (Get-PropertyValue -Row $_ -Name $statusField)
                $due -and $due.Date -lt $today -and ($closed -notcontains $status)
            })
            if ($bad.Count -gt 0) { return New-Finding -Pack $Pack -Rule $Rule -Evidence "$($bad.Count) rows are overdue and still open." -Count $bad.Count -AffectedKpis $AffectedKpis }
        }
    }
    $null
}

$packFiles = if ($ProcessPack -eq 'All') {
    Get-ChildItem -LiteralPath $rulesRoot -File -Filter '*.json'
}
else {
    $packFile = Join-Path $rulesRoot "$($packNameMap[$ProcessPack]).json"
    @(Get-Item -LiteralPath $packFile)
}
$packs = @($packFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json })
$mappingPathToUse = $MappingPath
if (-not $mappingPathToUse) {
    $mappingPathToUse = Join-Path $resolvedOut 'mapping-coverage.json'
    & (Join-Path $scriptRoot 'New-PowerBIProcessDataMapping.ps1') -Path $root -DataPath $DataPath -OutputPath $mappingPathToUse -Json | Out-Null
}
$mapping = Get-Content -Raw -LiteralPath $mappingPathToUse | ConvertFrom-Json
$tables = Read-DataTables -Folder $DataPath
$metricCatalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json | ConvertFrom-Json
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $root -Json | ConvertFrom-Json
$drift = & (Join-Path $scriptRoot 'New-PowerBISemanticContractDriftMonitor.ps1') -Path $root -Json | ConvertFrom-Json
$sensitive = & (Join-Path $scriptRoot 'New-PowerBISensitiveDataExposureMap.ps1') -Path $root -Json | ConvertFrom-Json

$allFindings = [System.Collections.Generic.List[object]]::new()
$kpiImpacts = [System.Collections.Generic.List[object]]::new()
foreach ($pack in $packs) {
    $processOut = Join-Path $resolvedOut $pack.id
    New-Item -ItemType Directory -Force -Path $processOut | Out-Null
    $terms = @($pack.kpiTerms)
    $affectedKpis = @($metricCatalog.metrics | Where-Object {
        $metricText = "$($_.name) $($_.description) $($_.businessDefinition)"
        @($terms | Where-Object { $metricText -match [regex]::Escape($_) }).Count -gt 0
    } | Select-Object -ExpandProperty name)
    foreach ($rule in @($pack.rules)) {
        $finding = Invoke-Rule -Pack $pack -Rule $rule -Mapping $mapping -Tables $tables -AffectedKpis $affectedKpis
        if ($finding) { $allFindings.Add($finding) | Out-Null }
    }
    foreach ($metric in @($trust.metrics | Where-Object { $affectedKpis -contains $_.name -or $affectedKpis -contains $_.metric })) {
        if ($metric.trustScore -lt 70) {
            $allFindings.Add((New-Finding -Pack $pack -Rule ([pscustomobject]@{ id = "$($pack.id).kpiTrust"; severity = 'Medium'; object = 'KPI'; field = 'trustScore'; description = 'Process KPI has low trust score.'; ownerHint = 'KPI owner'; recommendedAction = 'Confirm owner, definition, tests, and release use before process reporting.'; releaseImpact = 'Warn' }) -Evidence "Trust score is $($metric.trustScore)." -Count 1 -AffectedKpis @($metric.name))) | Out-Null
        }
        $kpiImpacts.Add([pscustomobject]@{ process = $pack.process; metric = $metric.name; trustScore = $metric.trustScore; impact = if ($metric.trustScore -lt 60) { 'High' } elseif ($metric.trustScore -lt 80) { 'Medium' } else { 'Low' } }) | Out-Null
    }
    $processFindings = @($allFindings | Where-Object { $_.process -eq $pack.process })
    [pscustomobject]@{ schema = 'codex.powerbi.businessProcessDataQuality.process.v1'; process = $pack.process; findingCount = $processFindings.Count; findings = $processFindings } |
        ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $processOut 'findings.json') -Encoding UTF8
}

if ($mapping.status -ne 'Mapped') {
    $allFindings.Add([pscustomobject]@{ ruleId = 'mapping.incomplete'; process = 'All'; severity = 'Medium'; object = 'Mapping'; field = ''; finding = 'Process object or required field mapping is incomplete.'; evidence = "Needs mapping count: $($mapping.needsMappingCount)."; affectedKpis = @(); ownerHint = 'Data owner'; recommendedAction = 'Review mapping-coverage.json and confirm canonical process objects.'; releaseImpact = 'Warn'; count = $mapping.needsMappingCount }) | Out-Null
}
foreach ($exposure in @($sensitive.exposures | Select-Object -First 10)) {
    $allFindings.Add([pscustomobject]@{ ruleId = 'sensitive.exposure'; process = 'CrossProcess'; severity = $exposure.risk; object = 'SensitiveData'; field = $exposure.field; finding = 'Sensitive data exposure may affect process reporting.'; evidence = "$($exposure.table)[$($exposure.field)]"; affectedKpis = @(); ownerHint = 'Security reviewer'; recommendedAction = $exposure.reviewAction; releaseImpact = if ($exposure.risk -eq 'High') { 'No-Go' } else { 'Warn' }; count = 1 }) | Out-Null
}
foreach ($driftItem in @($drift.drifts | Select-Object -First 10)) {
    $allFindings.Add([pscustomobject]@{ ruleId = 'semantic.contract.drift'; process = 'CrossProcess'; severity = 'Medium'; object = 'SemanticContract'; field = $driftItem.metric; finding = 'Semantic contract drift may affect process KPI trust.'; evidence = ($driftItem.issues -join '; '); affectedKpis = @($driftItem.metric); ownerHint = 'Semantic model owner'; recommendedAction = 'Resolve owner, contract, and usage expectation drift.'; releaseImpact = 'Warn'; count = 1 }) | Out-Null
}

$findings = @($allFindings)
$highCount = @($findings | Where-Object { $_.severity -eq 'High' }).Count
$mediumCount = @($findings | Where-Object { $_.severity -eq 'Medium' }).Count
$lowCount = @($findings | Where-Object { $_.severity -eq 'Low' }).Count
$summary = [pscustomobject]@{
    schema = 'codex.powerbi.businessProcessDataQuality.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    dataPath = if ($DataPath) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($DataPath) } else { $null }
    outputDirectory = $resolvedOut
    processPack = $ProcessPack
    status = if ($mapping.status -ne 'Mapped') { 'NeedsMapping' } elseif ($highCount -gt 0) { 'HighRisk' } elseif ($mediumCount -gt 0) { 'Review' } else { 'Passed' }
    processCount = @($packs).Count
    findingCount = $findings.Count
    highCount = $highCount
    mediumCount = $mediumCount
    lowCount = $lowCount
    mappingStatus = $mapping.status
    mappingNeedsCount = $mapping.needsMappingCount
    kpiImpactCount = @($kpiImpacts).Count
}

$summaryPath = Join-Path $resolvedOut 'summary.json'
$findingsPath = Join-Path $resolvedOut 'process-findings.json'
$kpiPath = Join-Path $resolvedOut 'kpi-impact.json'
$ownerPath = Join-Path $resolvedOut 'owner-actions.md'
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
[pscustomobject]@{ schema = 'codex.powerbi.businessProcessFindings.v1'; findings = $findings } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $findingsPath -Encoding UTF8
[pscustomobject]@{ schema = 'codex.powerbi.businessProcessKpiImpact.v1'; impacts = @($kpiImpacts) } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $kpiPath -Encoding UTF8
$ownerLines = @('# Business Process Data Quality Owner Actions', '', "Status: $($summary.status)", '')
$ownerLines += @($findings | Sort-Object severity, process | Select-Object -First 50 | ForEach-Object { "- [$($_.severity)] $($_.process) / $($_.ruleId): $($_.recommendedAction)" })
Set-Content -LiteralPath $ownerPath -Value (($ownerLines -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

$index = @(
    '# Business Process Data Quality Pack',
    '',
    "Status: $($summary.status)",
    "Findings: $($summary.findingCount)",
    "High: $highCount",
    "Medium: $mediumCount",
    '',
    '## Artifacts',
    ('- Summary: `{0}`' -f $summaryPath),
    ('- Findings: `{0}`' -f $findingsPath),
    ('- Mapping: `{0}`' -f $mappingPathToUse),
    ('- KPI impact: `{0}`' -f $kpiPath),
    ('- Owner actions: `{0}`' -f $ownerPath)
)
Set-Content -LiteralPath (Join-Path $resolvedOut 'README.md') -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

if ($FailOnHigh -and $highCount -gt 0) { throw "Business process data quality found $highCount high severity findings." }

if ($Json) { $summary | ConvertTo-Json -Depth 8 }
else { [pscustomobject]@{ OutputDirectory = $resolvedOut; Summary = $summaryPath; Findings = $findingsPath; Mapping = $mappingPathToUse; KpiImpact = $kpiPath; OwnerActions = $ownerPath; Status = $summary.status; FindingCount = $summary.findingCount; HighCount = $summary.highCount } }
