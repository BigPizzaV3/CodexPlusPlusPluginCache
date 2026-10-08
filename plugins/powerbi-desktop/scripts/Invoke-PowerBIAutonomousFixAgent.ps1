param(
    [string]$Path = ".",
    [string]$PbipPath,
    [string]$OutputPath,
    [int]$MaxFixes = 3,
    [switch]$Apply,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$simulations = & (Join-Path $scriptRoot 'New-PowerBIDaxFixSimulation.ps1') -Path $Path -Json | ConvertFrom-Json
$lineage = & (Join-Path $scriptRoot 'New-PowerBIMeasureLineageImpact.ps1') -Path $Path -Json | ConvertFrom-Json

$fixes = foreach ($sim in @($simulations.simulations | Select-Object -First $MaxFixes)) {
    $metric = @($catalog.metrics | Where-Object { $_.name -eq $sim.measure } | Select-Object -First 1)
    $impact = @($lineage.measures | Where-Object { $_.name -eq $sim.measure } | Select-Object -First 1)
    $applyResult = $null
    if ($Apply -and $PbipPath -and $metric.Count -gt 0) {
        $applyResult = & (Join-Path $scriptRoot 'Apply-PowerBIPBIPMeasureDraft.ps1') -PbipPath $PbipPath -TableName $metric[0].table -MeasureName $metric[0].name -Expression $sim.simulatedDax -Apply -Json | ConvertFrom-Json
    }
    [pscustomobject]@{
        measure = $sim.measure
        table = if ($metric.Count -gt 0) { $metric[0].table } else { $null }
        risk = $sim.risk
        impactScore = if ($impact.Count -gt 0) { $impact[0].impactScore } else { 0 }
        downstreamMeasures = if ($impact.Count -gt 0) { @($impact[0].downstreamMeasures) } else { @() }
        originalDax = $sim.originalDax
        proposedDax = $sim.simulatedDax
        validationQueries = @($sim.validationQueries)
        applyStatus = if ($applyResult) { 'AppliedDraft' } elseif ($Apply) { 'SkippedNoPbipOrMetric' } else { 'PlanOnly' }
        targetPath = if ($applyResult) { $applyResult.targetPath } else { $null }
        rollbackNote = $sim.rollbackNote
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.autonomousFixAgent.v1'
    generated = (Get-Date).ToString('s')
    source = (Resolve-Path -LiteralPath $Path).Path
    pbipPath = $PbipPath
    applied = [bool]$Apply
    fixCount = @($fixes).Count
    fixes = @($fixes)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$md = New-Object System.Collections.Generic.List[string]
$md.Add('# Power BI Autonomous Fix Agent')
$md.Add('')
$md.Add(('Applied: {0}' -f $result.applied))
$md.Add(('Fixes: {0}' -f $result.fixCount))
$md.Add('')
foreach ($fix in $result.fixes) {
    $md.Add(('## {0}' -f $fix.measure))
    $md.Add(('- Risk: {0}' -f $fix.risk))
    $md.Add(('- Impact score: {0}' -f $fix.impactScore))
    $md.Add(('- Apply status: {0}' -f $fix.applyStatus))
    if ($fix.targetPath) { $md.Add(('- Target: `{0}`' -f $fix.targetPath)) }
    $md.Add(('- Rollback: {0}' -f $fix.rollbackNote))
    $md.Add('')
}
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
