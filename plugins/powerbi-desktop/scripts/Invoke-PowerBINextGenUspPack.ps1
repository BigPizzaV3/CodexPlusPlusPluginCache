param(
    [string]$Path = '.',
    [string]$OutputDirectory = 'powerbi-nextgen-usp-pack',
    [string]$SnapshotDirectory,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Save-Artifact {
    param([string]$Name, $Value)
    $path = Join-Path $out $Name
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

function Read-JsonResult {
    param([string]$Script, [hashtable]$Arguments)
    & (Join-Path $scriptRoot $Script) @Arguments -Json | ConvertFrom-Json
}

$trust = Read-JsonResult 'New-PowerBIKpiTrustScore.ps1' @{ Path = $Path }
$capacity = Read-JsonResult 'New-PowerBIFabricCapacityRiskForecast.ps1' @{ Path = $Path }
$copilot = Read-JsonResult 'Test-PowerBICopilotReadiness.ps1' @{ Path = $Path }
$decision = Read-JsonResult 'New-PowerBIDecisionRiskAssistant.ps1' @{ Path = $Path }
$sla = Read-JsonResult 'New-PowerBIBusinessKpiSlaMonitor.ps1' @{ Path = $Path }
$files = Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue
$directLakeSignals = @($files | Select-String -Pattern 'DirectLake|OneLake|Lakehouse|Warehouse|Shortcut|Delta' -SimpleMatch -List -ErrorAction SilentlyContinue)

$artifacts = [ordered]@{}
$artifacts.finOps = Save-Artifact 'fabric-finops-copilot.json' ([pscustomobject]@{
    schema = 'codex.powerbi.fabricFinOpsCopilot.v1'; evidenceMaturity = 'LocalAndHeuristic';
    capacityRisk = $capacity.capacityRiskLevel; ownerAction = 'Attribute high-risk KPIs and their workspaces to a named cost owner.';
    optimizationCandidates = @($trust.metrics | Sort-Object trustScore | Select-Object -First 10 | ForEach-Object { [pscustomobject]@{ metric = $_.name; trustScore = $_.trustScore; action = 'Validate usage, cost and business value before optimization.' } })
})
$artifacts.copilotRegression = Save-Artifact 'copilot-answer-regression-lab.json' ([pscustomobject]@{
    schema = 'codex.powerbi.copilotAnswerRegression.v1'; evidenceMaturity = 'DraftWithOptionalLiveQuery';
    readiness = $copilot; testCases = @($trust.metrics | Select-Object -First 20 | ForEach-Object { [pscustomobject]@{ question = "What is $($_.name)?"; expectedEvidence = 'Measure definition, description, owner and semantic test.'; status = 'PendingAnswerCapture' } });
    nextAction = 'Run approved questions against Copilot or a live model, capture answers, then review correctness and source grounding.'
})
$artifacts.directLake = Save-Artifact 'directlake-onelake-readiness.json' ([pscustomobject]@{
    schema = 'codex.powerbi.directLakeReadiness.v1'; evidenceMaturity = 'LocalMetadata';
    detectedSignals = @($directLakeSignals | ForEach-Object { $_.Path }); signalCount = @($directLakeSignals).Count;
    status = if ($directLakeSignals) { 'NeedsArchitectureReview' } else { 'NoDirectLakeMetadataDetected' };
    checks = @('OneLake shortcut ownership', 'Delta schema drift', 'Lakehouse/Warehouse lineage', 'Direct Lake fallback behavior', 'capacity and refresh impact')
})
$artifacts.dataProductSlo = Save-Artifact 'data-product-slo-manager.json' ([pscustomobject]@{
    schema = 'codex.powerbi.dataProductSloManager.v1'; evidenceMaturity = 'LocalAndSnapshot';
    slaEvidence = $sla; defaultPolicy = [pscustomobject]@{ freshness = 'Define per KPI'; owner = 'Required'; breachAction = 'Warn, then block release when decision-critical'; reviewCadence = 'Per release' }
})
$artifacts.capacityVerifier = Save-Artifact 'capacity-change-verifier.json' ([pscustomobject]@{
    schema = 'codex.powerbi.capacityChangeVerifier.v1'; evidenceMaturity = 'BaselineRequired';
    baselineRequired = @('Capacity Metrics or CU snapshot before change', 'Capacity Metrics or CU snapshot after change', 'Item and operation identity');
    currentRisk = $capacity.capacityRiskLevel; verdict = 'PendingBeforeAfterEvidence';
    measures = @('CU consumption', 'throttling', 'query duration', 'refresh duration', 'cost attribution')
})
$artifacts.decisionTrace = Save-Artifact 'executive-decision-trace.json' ([pscustomobject]@{
    schema = 'codex.powerbi.executiveDecisionTrace.v1'; evidenceMaturity = 'LocalAndHeuristic';
    decisionRisks = $decision; trace = @($trust.metrics | Sort-Object trustScore | Select-Object -First 10 | ForEach-Object { [pscustomobject]@{ kpi = $_.name; trustScore = $_.trustScore; decisionStatus = if ($_.trustScore -lt 60) { 'NeedsOwnerReview' } else { 'UsableWithCaveats' }; evidence = 'KPI trust, semantic tests, lineage and owner sign-off.' } })
})

$result = [pscustomobject]@{ schema = 'codex.powerbi.nextGenUspPack.v1'; root = (Resolve-Path -LiteralPath $Path).Path; generated = (Get-Date).ToString('s'); artifactCount = $artifacts.Count; artifacts = $artifacts }
Save-Artifact 'summary.json' $result | Out-Null
if ($Json) { $result | ConvertTo-Json -Depth 12 } else { $result }
