param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path -LiteralPath $Path).Path

function Invoke-JsonScript {
    param([string]$ScriptName, [hashtable]$Arguments)
    $scriptPath = Join-Path $scriptRoot $ScriptName
    $cmdArgs = @{}
    foreach ($key in $Arguments.Keys) {
        if ($null -ne $Arguments[$key]) { $cmdArgs[$key] = $Arguments[$key] }
    }
    & $scriptPath @cmdArgs -Json | ConvertFrom-Json
}

function Read-OptionalJsonFiles {
    param([string]$RootPath)
    $pluginRoot = Split-Path -Parent $scriptRoot
    $candidateFiles = New-Object System.Collections.Generic.List[string]
    foreach ($candidate in @(
        (Join-Path $pluginRoot 'rules/powerbi-review-memory.json'),
        (Join-Path $RootPath 'powerbi-review-memory.json'),
        (Join-Path $RootPath 'powerbi-ai-change-journal.json')
    )) {
        if (Test-Path -LiteralPath $candidate) { $candidateFiles.Add((Resolve-Path -LiteralPath $candidate).Path) }
    }
    foreach ($pattern in @('*review-memory*.json', '*change-journal*.json')) {
        Get-ChildItem -LiteralPath $RootPath -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
            Select-Object -First 5 |
            ForEach-Object { $candidateFiles.Add($_.FullName) }
    }

    foreach ($file in @($candidateFiles.ToArray() | Sort-Object -Unique)) {
        try {
            $doc = Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
            [pscustomobject]@{ path = $file; schema = $doc.schema; document = $doc }
        }
        catch {
            [pscustomobject]@{ path = $file; schema = 'unreadable'; error = $_.Exception.Message }
        }
    }
}

function Get-SeverityFromTrustScore {
    param([int]$TrustScore, [bool]$ReleaseBlocker)
    if ($ReleaseBlocker -or $TrustScore -lt 60) { return 'High' }
    if ($TrustScore -lt 80) { return 'Medium' }
    return 'Low'
}

function Get-DueDateForSeverity {
    param([string]$Severity)
    $days = if ($Severity -eq 'High') { 7 } elseif ($Severity -eq 'Medium') { 14 } else { 30 }
    (Get-Date).Date.AddDays($days).ToString('yyyy-MM-dd')
}

function Convert-LiveCatalogToTrustScore {
    param([string]$RootPath)

    $liveCatalogPath = Join-Path $RootPath 'live-metric-catalog.json'
    if (-not (Test-Path -LiteralPath $liveCatalogPath)) { return $null }

    $liveCatalog = Get-Content -Raw -LiteralPath $liveCatalogPath | ConvertFrom-Json
    $metrics = foreach ($metric in @($liveCatalog.metrics)) {
        $score = 100
        $deductions = New-Object System.Collections.Generic.List[string]
        if (@($metric.risks).Count -gt 0) { $score -= 25; $deductions.Add('DAX risk detected') }
        if ($metric.owner -match 'TODO') { $score -= 15; $deductions.Add('Metric owner missing') }
        if ($metric.businessDefinition -match 'TODO') { $score -= 15; $deductions.Add('Business definition missing') }
        $score = [math]::Max(0, [int]$score)
        [pscustomobject]@{
            id = $metric.id
            name = $metric.name
            table = $metric.table
            trustScore = $score
            trustBand = $(if ($score -ge 80) { 'High' } elseif ($score -ge 60) { 'Medium' } else { 'Low' })
            deductions = @($deductions.ToArray())
            riskCount = @($metric.risks).Count
            downstreamCount = 0
            generatedTestCount = 0
            releaseUse = $(if ($score -ge 80) { 'Approved candidate after business sign-off.' } elseif ($score -ge 60) { 'Use with warning and validation note.' } else { 'Do not use for executive release without remediation.' })
        }
    }
    $overall = if (@($metrics).Count -gt 0) { [int]((@($metrics | Select-Object -ExpandProperty trustScore) | Measure-Object -Average).Average) } else { 0 }
    [pscustomobject]@{
        schema = 'codex.powerbi.kpiTrustScore.liveCatalogFallback.v1'
        root = $liveCatalog.root
        metricCount = @($metrics).Count
        overallTrustScore = $overall
        metrics = @($metrics)
    }
}

$trust = Invoke-JsonScript -ScriptName 'New-PowerBIKpiTrustScore.ps1' -Arguments @{ Path = $Path }
if (@($trust.metrics).Count -eq 0) {
    $liveTrust = Convert-LiveCatalogToTrustScore -RootPath $root
    if ($liveTrust) { $trust = $liveTrust }
}
$gate = Invoke-JsonScript -ScriptName 'New-PowerBITrustReleaseGate.ps1' -Arguments @{ Path = $Path }
$fixPlan = Invoke-JsonScript -ScriptName 'New-PowerBIGuidedFixPlan.ps1' -Arguments @{ Path = $Path }
$optionalDocs = @(Read-OptionalJsonFiles -RootPath $root)

$debtItems = foreach ($metric in @($trust.metrics)) {
    $fixes = @($fixPlan.fixes | Where-Object { $_.source -eq $metric.name -or $_.problem -match [regex]::Escape($metric.name) })
    $blockingFixes = @($fixes | Where-Object { $_.priority -eq 'P0' -or $_.releaseGate -match '(?i)block' })
    $releaseBlocker = ($metric.trustScore -lt 60 -or $blockingFixes.Count -gt 0)
    $severity = Get-SeverityFromTrustScore -TrustScore ([int]$metric.trustScore) -ReleaseBlocker $releaseBlocker
    $ownerMissing = @($metric.deductions | Where-Object { $_ -match '(?i)owner' }).Count -gt 0
    $definitionMissing = @($metric.deductions | Where-Object { $_ -match '(?i)definition' }).Count -gt 0
    $signals = New-Object System.Collections.Generic.List[string]
    $signals.Add(('trustScore:{0}/{1}' -f $metric.trustScore, $metric.trustBand))
    foreach ($deduction in @($metric.deductions)) { $signals.Add(('deduction:{0}' -f $deduction)) }
    foreach ($fix in $fixes) { $signals.Add(('guidedFix:{0}:{1}' -f $fix.priority, $fix.problem)) }
    if ($releaseBlocker) { $signals.Add('releaseGate:blockerCandidate') }

    [pscustomobject]@{
        metric = $metric.name
        trustScore = $metric.trustScore
        ownerStatus = if ($ownerMissing) { 'Missing' } elseif ($definitionMissing) { 'DefinitionMissing' } else { 'PresentOrInherited' }
        dueDate = Get-DueDateForSeverity -Severity $severity
        recurrenceHint = if ($metric.downstreamCount -gt 0) { 'Review after upstream/downstream model changes.' } elseif ($metric.riskCount -gt 0) { 'Review whenever DAX expression changes.' } else { 'Review during normal release readiness.' }
        releaseBlocker = $releaseBlocker
        recommendedAction = if ($fixes.Count -gt 0) { $fixes[0].guidedStep } elseif ($metric.trustScore -lt 80) { $metric.releaseUse } else { 'Keep owner, definition, and validation evidence current.' }
        severity = $severity
        sourceSignals = @($signals.ToArray())
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.trustDebtLedger.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    overallTrustScore = $trust.overallTrustScore
    releaseDecision = $gate.decision
    debtItemCount = @($debtItems).Count
    releaseBlockerCount = @($debtItems | Where-Object { $_.releaseBlocker }).Count
    optionalEvidence = @($optionalDocs | ForEach-Object {
        [pscustomobject]@{
            path = $_.path
            schema = $_.schema
            reviewCount = if ($_.document.PSObject.Properties.Name -contains 'reviews') { @($_.document.reviews).Count } else { $null }
            entryCount = if ($_.document.PSObject.Properties.Name -contains 'entries') { @($_.document.entries).Count } else { $null }
        }
    })
    debtItems = @($debtItems | Sort-Object @{ Expression = { @{ High = 0; Medium = 1; Low = 2 }[$_.severity] } }, metric)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Trust Debt Ledger')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $result.schema))
$lines.Add(('Root: `{0}`' -f $result.root))
$lines.Add(('Generated: {0}' -f $result.generated))
$lines.Add(('Overall trust score: **{0}**' -f $result.overallTrustScore))
$lines.Add(('Release decision: **{0}**' -f $result.releaseDecision))
$lines.Add(('Debt items: {0}' -f $result.debtItemCount))
$lines.Add(('Release blockers: {0}' -f $result.releaseBlockerCount))
$lines.Add('')
$lines.Add('## Debt Items')
$lines.Add('')
foreach ($item in $result.debtItems) {
    $lines.Add(('### [{0}] {1}' -f $item.severity, $item.metric))
    $lines.Add(('- Trust score: {0}' -f $item.trustScore))
    $lines.Add(('- Owner status: {0}' -f $item.ownerStatus))
    $lines.Add(('- Due date: {0}' -f $item.dueDate))
    $lines.Add(('- Recurrence hint: {0}' -f $item.recurrenceHint))
    $lines.Add(('- Release blocker: {0}' -f $item.releaseBlocker))
    $lines.Add(('- Recommended action: {0}' -f $item.recommendedAction))
    $lines.Add(('- Source signals: {0}' -f (@($item.sourceSignals) -join '; ')))
    $lines.Add('')
}
if (@($result.optionalEvidence).Count -gt 0) {
    $lines.Add('## Optional Evidence')
    $lines.Add('')
    foreach ($evidence in $result.optionalEvidence) {
        $lines.Add(('- `{0}` ({1})' -f $evidence.path, $evidence.schema))
    }
    $lines.Add('')
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
