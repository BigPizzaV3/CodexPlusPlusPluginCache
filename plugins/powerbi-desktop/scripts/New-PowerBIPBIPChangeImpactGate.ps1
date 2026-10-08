param(
    [string]$Path = ".",
    [string]$BaseRef,
    [string]$HeadRef = "HEAD",
    [string]$ChangedFilesPath,
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
        if ($null -ne $Arguments[$key] -and $Arguments[$key] -ne '') { $cmdArgs[$key] = $Arguments[$key] }
    }
    try { & $scriptPath @cmdArgs -Json | ConvertFrom-Json } catch { [pscustomobject]@{ error = $_.Exception.Message } }
}

function Get-ChangedFiles {
    if ($ChangedFilesPath -and (Test-Path -LiteralPath $ChangedFilesPath)) {
        $raw = Get-Content -LiteralPath $ChangedFilesPath
        return @($raw | Where-Object { $_ -and -not $_.StartsWith('#') })
    }
    if ($BaseRef) {
        try {
            $range = if ($HeadRef) { "$BaseRef..$HeadRef" } else { $BaseRef }
            return @(git -C $root diff --name-only $range 2>$null | Where-Object { $_ })
        }
        catch { }
    }
    try { return @(git -C $root status --short 2>$null | ForEach-Object { ($_ -replace '^.. ', '').Trim() } | Where-Object { $_ }) } catch { @() }
}

function Test-TextMentionsMetric {
    param([string]$Text, [object]$Metric)
    if (-not $Text) { return $false }
    if ($Metric.name -and $Text -match [regex]::Escape($Metric.name)) { return $true }
    if ($Metric.id -and $Text -match [regex]::Escape($Metric.id)) { return $true }
    if ($Metric.table -and $Text -match [regex]::Escape($Metric.table)) { return $true }
    $false
}

$changedFiles = @(Get-ChangedFiles)
$catalog = Invoke-JsonScript 'New-PowerBIMetricCatalog.ps1' @{ Path = $root }
$dependency = Invoke-JsonScript 'New-PowerBIDependencyGraph.ps1' @{ Path = $root }
$trust = Invoke-JsonScript 'New-PowerBIKpiTrustScore.ps1' @{ Path = $root }
$usage = Invoke-JsonScript 'New-PowerBIUsageTrustMatrix.ps1' @{ Path = $root }
$visualImpact = Invoke-JsonScript 'New-PowerBIVisualMeasureImpactMap.ps1' @{ Path = $root }

$changedTexts = foreach ($file in $changedFiles) {
    $full = Join-Path $root $file
    if (Test-Path -LiteralPath $full -PathType Leaf) {
        try { [pscustomobject]@{ path = $file; text = (Get-Content -Raw -LiteralPath $full -ErrorAction Stop) } }
        catch { [pscustomobject]@{ path = $file; text = '' } }
    }
    else { [pscustomobject]@{ path = $file; text = $file } }
}

$affectedMetrics = foreach ($metric in @($catalog.metrics)) {
    $hits = @($changedTexts | Where-Object { (Test-TextMentionsMetric -Text $_.text -Metric $metric) -or (Test-TextMentionsMetric -Text $_.path -Metric $metric) })
    if ($hits.Count -eq 0 -and $changedFiles.Count -gt 0) { continue }
    $trustItem = @($trust.metrics | Where-Object { $_.name -eq $metric.name } | Select-Object -First 1)
    $usageItem = @($usage.matrixItems | Where-Object { $_.metricName -eq $metric.name } | Select-Object -First 1)
    $visuals = @($visualImpact.impacts | Where-Object { $_.measure -eq $metric.name -or $_.measureName -eq $metric.name })
    $edges = @($dependency.edges | Where-Object { $_.from -eq $metric.name -or $_.to -eq $metric.name })
    [pscustomobject]@{
        metric = $metric.name
        table = $metric.table
        changedFiles = @($hits | Select-Object -ExpandProperty path -Unique)
        trustScore = if ($trustItem) { $trustItem.trustScore } else { $null }
        usagePriority = if ($usageItem) { $usageItem.priority } else { $null }
        dependencyEdgeCount = $edges.Count
        visualReferenceCount = $visuals.Count
        releaseImpact = if ($trustItem -and $trustItem.trustScore -lt 60) { 'BlockerCandidate' } elseif ($edges.Count -gt 2 -or $visuals.Count -gt 0) { 'ReviewRequired' } else { 'Low' }
    }
}

$blockers = @($affectedMetrics | Where-Object { $_.releaseImpact -eq 'BlockerCandidate' })
$review = @($affectedMetrics | Where-Object { $_.releaseImpact -eq 'ReviewRequired' })
$decision = if ($blockers.Count -gt 0) { 'No-Go' } elseif ($review.Count -gt 0 -or $changedFiles.Count -eq 0) { 'Warn' } else { 'Go' }
$result = [pscustomobject]@{
    schema = 'codex.powerbi.pbipChangeImpactGate.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    baseRef = $BaseRef
    headRef = $HeadRef
    changeCount = $changedFiles.Count
    changedFiles = @($changedFiles)
    affectedMetricCount = @($affectedMetrics).Count
    decision = $decision
    blockingReasonCount = $blockers.Count
    affectedMetrics = @($affectedMetrics | Sort-Object releaseImpact, metric)
    prSummary = if ($decision -eq 'Go') { 'No KPI release blockers detected from changed files.' } elseif ($decision -eq 'Warn') { 'KPI impact requires reviewer attention before release.' } else { 'KPI trust blockers are affected by this change.' }
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @('# Power BI PBIP Change Impact Gate', '', "Decision: **$decision**", "Changed files: $($changedFiles.Count)", "Affected metrics: $($result.affectedMetricCount)", '', '## Affected Metrics') +
    @($result.affectedMetrics | ForEach-Object { "- [$($_.releaseImpact)] $($_.metric): trust=$($_.trustScore), dependencies=$($_.dependencyEdgeCount), visuals=$($_.visualReferenceCount)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
