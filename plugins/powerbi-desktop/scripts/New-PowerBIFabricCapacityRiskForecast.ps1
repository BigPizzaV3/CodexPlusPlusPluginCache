param(
    [string]$Path = ".",
    [string]$VpaxPath,
    [string]$TracePath,
    [string]$ServiceScannerPath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolved = (Resolve-Path -LiteralPath $Path).Path

function Read-JsonFile {
    param([string]$LiteralPath)
    if ($LiteralPath -and (Test-Path -LiteralPath $LiteralPath)) {
        $raw = Get-Content -Raw -LiteralPath $LiteralPath
        if ($raw.Trim().StartsWith('{') -or $raw.Trim().StartsWith('[')) {
            return ($raw | ConvertFrom-Json)
        }
    }
    $null
}

function New-RiskItem {
    param([string]$Area, [string]$Severity, [string]$Title, [string]$Detail, [string]$Mitigation)
    [pscustomobject]@{
        area = $Area
        severity = $Severity
        title = $Title
        detail = $Detail
        mitigation = $Mitigation
    }
}

function Get-SeverityScore {
    param([string]$Severity)
    switch ($Severity) {
        'Critical' { 100 }
        'High' { 80 }
        'Medium' { 50 }
        'Low' { 20 }
        default { 35 }
    }
}

$heatmap = & (Join-Path $scriptRoot 'New-PowerBIModelRiskHeatmap.ps1') -Path $resolved -Json | ConvertFrom-Json
$fabric = & (Join-Path $scriptRoot 'New-PowerBIFabricReadinessPlan.ps1') -Path $resolved -Json | ConvertFrom-Json
$vertipaq = & (Join-Path $scriptRoot 'Import-PowerBIVertiPaqAnalyzer.ps1') -Path $resolved -VpaxPath $VpaxPath -Json | ConvertFrom-Json
$trace = & (Join-Path $scriptRoot 'Import-PowerBIPerformanceTrace.ps1') -Path $resolved -TracePath $TracePath -Json | ConvertFrom-Json
$service = Read-JsonFile -LiteralPath $ServiceScannerPath
if (-not $service) {
    $service = & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $resolved -Json | ConvertFrom-Json
}

$riskItems = New-Object System.Collections.Generic.List[object]
foreach ($area in @($heatmap.areas | Where-Object { $_.score -ge 35 })) {
    $severity = if ($area.score -ge 70) { 'High' } elseif ($area.score -ge 35) { 'Medium' } else { 'Low' }
    $riskItems.Add((New-RiskItem 'Model' $severity $area.name $area.detail 'Reduce semantic model risk before Fabric capacity rollout.'))
}
foreach ($step in @($fabric.steps | Where-Object required)) {
    $riskItems.Add((New-RiskItem 'Fabric readiness' 'Medium' $step.phase $step.action 'Complete required readiness step before deployment.'))
}
foreach ($column in @($vertipaq.columns | Where-Object { $_.risk -in @('High', 'Medium', 'Unknown') } | Select-Object -First 10)) {
    $severity = if ($column.risk -eq 'High') { 'High' } elseif ($column.risk -eq 'Medium') { 'Medium' } else { 'Low' }
    $riskItems.Add((New-RiskItem 'Storage' $severity "$($column.table)[$($column.column)]" $column.recommendation 'Capture VPAX and optimize high-cardinality or unused import columns.'))
}
foreach ($hotspot in @($trace.hotspots | Select-Object -First 10)) {
    $severity = if ($hotspot.durationMs -and $hotspot.durationMs -ge 3000) { 'High' } elseif ($hotspot.durationMs -and $hotspot.durationMs -ge 1000) { 'Medium' } else { 'Low' }
    $riskItems.Add((New-RiskItem 'Query' $severity $hotspot.name $hotspot.recommendation 'Validate DAX query plan and visual interaction cost under expected concurrency.'))
}
foreach ($finding in @($service.findings | Where-Object { $_.severity -in @('Critical', 'High', 'Medium') })) {
    $riskItems.Add((New-RiskItem 'Service governance' $finding.severity $finding.title $finding.detail 'Resolve service governance evidence before capacity commitment.'))
}

$capacityRiskScore = if ($riskItems.Count -gt 0) {
    [int]([math]::Min(100, (($riskItems | ForEach-Object { Get-SeverityScore $_.severity }) | Measure-Object -Average).Average + [math]::Min(20, $riskItems.Count * 2)))
}
else { 10 }
$refreshRisk = [int]([math]::Min(100, (@($riskItems | Where-Object { $_.area -in @('Storage', 'Service governance') }).Count * 18) + $(if ($service.releaseDecision -eq 'No-Go') { 25 } elseif ($service.releaseDecision -eq 'Warn') { 10 } else { 0 })))
$queryRisk = [int]([math]::Min(100, (@($riskItems | Where-Object area -eq 'Query').Count * 20) + [math]::Min(40, @($trace.hotspots).Count * 8)))

$mitigationPlan = @(
    [pscustomobject]@{ priority = 'P0'; action = 'Resolve No-Go release gate and high service scanner findings.'; condition = ($service.releaseDecision -eq 'No-Go' -or @($service.findings | Where-Object severity -in @('Critical', 'High')).Count -gt 0) },
    [pscustomobject]@{ priority = 'P1'; action = 'Capture VPAX and Performance Analyzer/DAX Studio traces for capacity sizing evidence.'; condition = (-not $VpaxPath -or -not $TracePath) },
    [pscustomobject]@{ priority = 'P1'; action = 'Reduce high-cardinality import columns and expensive DAX hotspots before Premium/Fabric rollout.'; condition = ($refreshRisk -ge 50 -or $queryRisk -ge 50) },
    [pscustomobject]@{ priority = 'P2'; action = 'Document workspace owner, refresh owner, gateway mapping, and deployment pipeline runbook.'; condition = $true }
) | Where-Object condition | ForEach-Object { [pscustomobject]@{ priority = $_.priority; action = $_.action } }

$result = [pscustomobject]@{
    schema = 'codex.powerbi.fabricCapacityRiskForecast.v1'
    generated = (Get-Date).ToString('s')
    source = $resolved
    vpaxPath = $VpaxPath
    tracePath = $TracePath
    serviceScannerPath = $ServiceScannerPath
    capacityRiskScore = $capacityRiskScore
    capacityRiskLevel = if ($capacityRiskScore -ge 70) { 'High' } elseif ($capacityRiskScore -ge 35) { 'Medium' } else { 'Low' }
    refreshRisk = $refreshRisk
    queryRisk = $queryRisk
    modelRisk = $heatmap.overallRisk
    fabricReleaseDecision = $fabric.releaseDecision
    serviceReleaseDecision = $service.releaseDecision
    riskItems = @($riskItems.ToArray())
    mitigationPlan = @($mitigationPlan)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @(
    '# Power BI Fabric Capacity Risk Forecast',
    '',
    "Capacity risk score: $capacityRiskScore ($($result.capacityRiskLevel))",
    "Refresh risk: $refreshRisk",
    "Query risk: $queryRisk",
    '',
    '## Risk items'
) + @($riskItems | ForEach-Object { "- [$($_.severity)] $($_.area): $($_.title) - $($_.detail)" }) + @('', '## Mitigation plan') + @($mitigationPlan | ForEach-Object { "- [$($_.priority)] $($_.action)" })

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
