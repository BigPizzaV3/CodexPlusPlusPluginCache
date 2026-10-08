param(
    [string]$Path = ".",
    [string]$OutputDirectory = "powerbi-release-candidate-pack",
    [switch]$SkipLive,
    [switch]$IncludeBusinessProcessDQ,
    [switch]$IncludeAnalyticalQa,
    [switch]$IncludeAdvancedUspQa,
    [switch]$IncludePortfolioGovernanceQa,
    [switch]$IncludeComplianceQa,
    [switch]$IncludeOperationsQa,
    [switch]$IncludeFabricLiveQa,
    [switch]$IncludeFabricPortfolioQa,
    [switch]$IncludeFabricDeploymentQa,
    [switch]$IncludeFabricOperationsQa,
    [switch]$IncludeFabricGovernanceQa,
    [switch]$IncludeFabricExecutiveQa,
    [switch]$IncludeNextGenUspQa,
    [switch]$IncludeKpiSloActions,
    [switch]$IncludeEnterpriseOperationsQa,
    [switch]$IncludeDecisionIntelligenceQa,
    [string]$TenantId,
    [string]$WorkspaceId,
    [string]$WorkspaceName,
    [string]$ItemId,
    [string]$AccessTokenPath,
    [string]$SnapshotDirectory,
    [string]$BusinessProcessDataPath,
    [string]$BusinessProcessMappingPath
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

$unifiedErrorLog = Join-Path $resolvedOut 'unified-review-errors.log'
if ($SkipLive) {
    $unified = & (Join-Path $scriptRoot 'Invoke-PowerBIUnifiedReview.ps1') -Path $Path -OutputDirectory (Join-Path $resolvedOut 'unified-review') -SkipLive 2>$unifiedErrorLog
}
else {
    $unified = & (Join-Path $scriptRoot 'Invoke-PowerBIUnifiedReview.ps1') -Path $Path -OutputDirectory (Join-Path $resolvedOut 'unified-review')
    if (Test-Path -LiteralPath $unifiedErrorLog) { Remove-Item -LiteralPath $unifiedErrorLog -Force }
}
$maxAiErrorLog = Join-Path $resolvedOut 'max-ai-review-errors.log'
if ($SkipLive) {
    $maxAi = & (Join-Path $scriptRoot 'Invoke-PowerBIMaxAIReview.ps1') -Path $Path -OutputDirectory (Join-Path $resolvedOut 'max-ai-review') 2>$maxAiErrorLog
}
else {
    $maxAi = & (Join-Path $scriptRoot 'Invoke-PowerBIMaxAIReview.ps1') -Path $Path -OutputDirectory (Join-Path $resolvedOut 'max-ai-review')
    if (Test-Path -LiteralPath $maxAiErrorLog) { Remove-Item -LiteralPath $maxAiErrorLog -Force }
}
& (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'service-scanner.json') -Json | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIModelRiskHeatmap.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'model-risk-heatmap.json') -Json | Out-Null
& (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'semantic-tests.json') -Json | Out-Null
& (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'pbip-structure.json') -Json | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIGovernancePolicyPack.ps1') -OutputPath (Join-Path $resolvedOut 'governance-policy-pack.json') -Json | Out-Null
& (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'trust-release-gate.json') -Json | Out-Null
& (Join-Path $scriptRoot 'New-PowerBITrustDebtLedger.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'trust-debt-ledger.json') -Json | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIFabricCapacityRiskForecast.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'fabric-capacity-risk.json') -Json | Out-Null
& (Join-Path $scriptRoot 'Test-PowerBIRlsLeakage.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'rls-leakage.json') -Json | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'usage-trust-matrix.json') -Json | Out-Null
& (Join-Path $scriptRoot 'Test-PowerBIPBIPRollbackReadiness.ps1') -PbipPath $Path -OutputPath (Join-Path $resolvedOut 'pbip-rollback-readiness.json') -Json | Out-Null
if ($IncludeBusinessProcessDQ) {
    & (Join-Path $scriptRoot 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $Path -DataPath $BusinessProcessDataPath -MappingPath $BusinessProcessMappingPath -OutputDirectory (Join-Path $resolvedOut 'business-process-dq') -Json | Out-Null
}
$analyticalMethodologyPath = Join-Path $resolvedOut 'analysis-methodology-validation.json'
$analyticalDiagnosisPath = Join-Path $resolvedOut 'metric-change-diagnosis.json'
$analyticalReportPath = Join-Path $resolvedOut 'analytical-release-report.md'
$analyticalQaAvailable = $IncludeAnalyticalQa -or (Test-Path -LiteralPath $analyticalMethodologyPath) -or (Test-Path -LiteralPath $analyticalDiagnosisPath) -or (Test-Path -LiteralPath $analyticalReportPath)
if ($IncludeAnalyticalQa) {
    & (Join-Path $scriptRoot 'Test-PowerBIAnalysisMethodology.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $analyticalMethodologyPath -Json | Out-Null
    $trustForDiagnosis = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
    $diagnosticMetric = @($trustForDiagnosis.metrics | Sort-Object trustScore, name | Select-Object -First 1)
    if ($diagnosticMetric) {
        & (Join-Path $scriptRoot 'New-PowerBIMetricChangeDiagnosis.ps1') -Path $Path -MetricName $diagnosticMetric.name -ComparisonLabel 'release candidate analytical QA' -OutputPath $analyticalDiagnosisPath -Json | Out-Null
    }
    & (Join-Path $scriptRoot 'New-PowerBIAnalyticalReleaseReport.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $analyticalReportPath | Out-Null
}
$advancedUspArtifacts = [ordered]@{
    evidenceGraph = Join-Path $resolvedOut 'evidence-graph.json'
    visualMeasureImpact = Join-Path $resolvedOut 'visual-measure-impact-map.json'
    semanticContract = Join-Path $resolvedOut 'semantic-contract-test.json'
    executiveTrustBrief = Join-Path $resolvedOut 'executive-trust-brief.md'
    daxChangeRisk = Join-Path $resolvedOut 'dax-change-risk-classifier.json'
    dataFreshnessLineage = Join-Path $resolvedOut 'data-freshness-lineage-gate.json'
    kpiDriftWatchlist = Join-Path $resolvedOut 'kpi-drift-watchlist.json'
    rlsTrustReview = Join-Path $resolvedOut 'rls-trust-review.json'
    reportUxRegression = Join-Path $resolvedOut 'report-ux-regression-scanner.json'
    migrationReadiness = Join-Path $resolvedOut 'migration-readiness.json'
}
if ($IncludeAdvancedUspQa) {
    & (Join-Path $scriptRoot 'New-PowerBIEvidenceGraph.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $advancedUspArtifacts.evidenceGraph -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $Path -OutputPath $advancedUspArtifacts.visualMeasureImpact -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBISemanticContract.ps1') -Path $Path -OutputPath $advancedUspArtifacts.semanticContract -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIExecutiveTrustBrief.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $advancedUspArtifacts.executiveTrustBrief | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIDaxChangeRiskClassifier.ps1') -Path $Path -OutputPath $advancedUspArtifacts.daxChangeRisk -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIDataFreshnessLineageGate.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $advancedUspArtifacts.dataFreshnessLineage -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIKpiDriftWatchlist.ps1') -Path $Path -OutputPath $advancedUspArtifacts.kpiDriftWatchlist -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIRlsTrustReview.ps1') -Path $Path -OutputPath $advancedUspArtifacts.rlsTrustReview -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIReportUxRegressionScanner.ps1') -Path $Path -OutputPath $advancedUspArtifacts.reportUxRegression -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIMigrationReadiness.ps1') -Path $Path -OutputPath $advancedUspArtifacts.migrationReadiness -Json | Out-Null
}
$portfolioArtifacts = [ordered]@{
    portfolioCommandCenter = Join-Path $resolvedOut 'portfolio-command-center.json'
    costToTrustOptimizer = Join-Path $resolvedOut 'cost-to-trust-optimizer.json'
    tenantHygieneScanner = Join-Path $resolvedOut 'tenant-hygiene-scanner.json'
    kpiDefinitionConflictResolution = Join-Path $resolvedOut 'kpi-definition-conflict-resolution.json'
}
$complianceArtifacts = [ordered]@{
    deploymentPipelineGate = Join-Path $resolvedOut 'deployment-pipeline-gate.json'
    certifiedDatasetReadiness = Join-Path $resolvedOut 'certified-dataset-readiness.json'
    reportAccessibilityCompliance = Join-Path $resolvedOut 'report-accessibility-compliance.json'
    powerQueryDataContract = Join-Path $resolvedOut 'power-query-data-contract.json'
    releaseEvidenceSignature = Join-Path $resolvedOut 'release-evidence-signature.json'
}
$operationsArtifacts = [ordered]@{
    refreshFailureRootCause = Join-Path $resolvedOut 'refresh-failure-root-cause.json'
    semanticTestCoverageScore = Join-Path $resolvedOut 'semantic-test-coverage-score.json'
    businessKpiSlaMonitor = Join-Path $resolvedOut 'business-kpi-sla-monitor.json'
}
if ($IncludePortfolioGovernanceQa) {
    & (Join-Path $scriptRoot 'New-PowerBIPortfolioCommandCenter.ps1') -Path $Path -OutputPath $portfolioArtifacts.portfolioCommandCenter -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBICostToTrustOptimizer.ps1') -Path $Path -OutputPath $portfolioArtifacts.costToTrustOptimizer -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBITenantHygieneScanner.ps1') -Path $Path -OutputPath $portfolioArtifacts.tenantHygieneScanner -Json | Out-Null
    & (Join-Path $scriptRoot 'Resolve-PowerBIKpiDefinitionConflict.ps1') -Path $Path -OutputPath $portfolioArtifacts.kpiDefinitionConflictResolution -Json | Out-Null
}
if ($IncludeComplianceQa) {
    & (Join-Path $scriptRoot 'Test-PowerBIDeploymentPipelineGate.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $complianceArtifacts.deploymentPipelineGate -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBICertifiedDatasetReadiness.ps1') -Path $Path -OutputPath $complianceArtifacts.certifiedDatasetReadiness -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIReportAccessibilityCompliance.ps1') -Path $Path -OutputPath $complianceArtifacts.reportAccessibilityCompliance -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIPowerQueryDataContract.ps1') -Path $Path -OutputPath $complianceArtifacts.powerQueryDataContract -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIReleaseEvidenceSignature.ps1') -Path $Path -ReviewDirectory $resolvedOut -OutputPath $complianceArtifacts.releaseEvidenceSignature -Json | Out-Null
}
if ($IncludeOperationsQa) {
    & (Join-Path $scriptRoot 'New-PowerBIRefreshFailureRootCauseAdvisor.ps1') -Path $Path -OutputPath $operationsArtifacts.refreshFailureRootCause -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBISemanticTestCoverageScore.ps1') -Path $Path -OutputPath $operationsArtifacts.semanticTestCoverageScore -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIBusinessKpiSlaMonitor.ps1') -Path $Path -OutputPath $operationsArtifacts.businessKpiSlaMonitor -Json | Out-Null
}
$nextGenUspPack = $null
$nextGenUspSummaryPath = Join-Path $resolvedOut 'nextgen-usps/summary.json'
if ($IncludeNextGenUspQa) {
    $nextGenUspPack = & (Join-Path $scriptRoot 'Invoke-PowerBINextGenUspPack.ps1') -Path $Path -SnapshotDirectory $SnapshotDirectory -OutputDirectory (Join-Path $resolvedOut 'nextgen-usps') -Json | ConvertFrom-Json
}
$kpiSloActionList = $null
$kpiSloActionListPath = Join-Path $resolvedOut 'kpi-slo-action-list.json'
if ($IncludeKpiSloActions) {
    $kpiSloActionList = & (Join-Path $scriptRoot 'New-PowerBIKpiSloActionList.ps1') -Path $Path -OutputPath $kpiSloActionListPath -Json | ConvertFrom-Json
}
$enterpriseOperations = $null
$enterpriseOperationsSummaryPath = Join-Path $resolvedOut 'enterprise-operations/summary.json'
if ($IncludeEnterpriseOperationsQa) {
    $enterpriseOperations = & (Join-Path $scriptRoot 'Invoke-PowerBIEnterpriseOperationsPack.ps1') -Path $Path -OutputDirectory (Join-Path $resolvedOut 'enterprise-operations') -Json | ConvertFrom-Json
}
$decisionIntelligence = $null
$decisionIntelligenceSummaryPath = Join-Path $resolvedOut 'decision-intelligence/summary.json'
if ($IncludeDecisionIntelligenceQa) {
    $decisionIntelligence = & (Join-Path $scriptRoot 'Invoke-PowerBIDecisionIntelligencePack.ps1') -Path $Path -OutputDirectory (Join-Path $resolvedOut 'decision-intelligence') -Json | ConvertFrom-Json
}
$fabricSnapshotDirectory = $null
$fabricAccessPlanPath = Join-Path $resolvedOut 'fabric-access-plan.json'
$fabricWorkspaceSnapshotSummaryPath = Join-Path $resolvedOut 'fabric-workspace-snapshot/summary.json'
if ($SnapshotDirectory -and (Test-Path -LiteralPath $SnapshotDirectory)) {
    $fabricSnapshotDirectory = (Resolve-Path -LiteralPath $SnapshotDirectory).Path
}
if ($IncludeFabricLiveQa) {
    if ($fabricSnapshotDirectory) {
        $snapshot = & (Join-Path $scriptRoot 'Import-PowerBIFabricWorkspaceSnapshot.ps1') -SnapshotDirectory $fabricSnapshotDirectory -TenantId $TenantId -WorkspaceId $WorkspaceId -WorkspaceName $WorkspaceName -ItemId $ItemId -OutputDirectory (Join-Path $resolvedOut 'fabric-workspace-snapshot') -Json | ConvertFrom-Json
        $fabricSnapshotDirectory = $snapshot.OutputDirectory
    }
    elseif ($AccessTokenPath -and (Test-Path -LiteralPath $AccessTokenPath) -and ($WorkspaceId -or $WorkspaceName)) {
        $snapshot = & (Join-Path $scriptRoot 'Import-PowerBIFabricWorkspaceSnapshot.ps1') -AccessTokenPath $AccessTokenPath -TenantId $TenantId -WorkspaceId $WorkspaceId -WorkspaceName $WorkspaceName -ItemId $ItemId -OutputDirectory (Join-Path $resolvedOut 'fabric-workspace-snapshot') -Json | ConvertFrom-Json
        $fabricSnapshotDirectory = $snapshot.OutputDirectory
    }
    else {
        & (Join-Path $scriptRoot 'Get-PowerBIFabricAccessPlan.ps1') -TenantId $TenantId -WorkspaceId $WorkspaceId -WorkspaceName $WorkspaceName -ItemId $ItemId -AccessTokenPath $AccessTokenPath -SnapshotDirectory $SnapshotDirectory -OutputPath $fabricAccessPlanPath -Json | Out-Null
    }
}
$fabricArtifacts = [ordered]@{
    portfolioCommandCenter = Join-Path $resolvedOut 'fabric-portfolio-command-center.json'
    tenantHygieneScanner = Join-Path $resolvedOut 'fabric-tenant-hygiene-scanner.json'
    costToTrustOptimizer = Join-Path $resolvedOut 'fabric-cost-to-trust-optimizer.json'
    workspaceRiskRadar = Join-Path $resolvedOut 'fabric-workspace-risk-radar.json'
    artifactRetirementBoard = Join-Path $resolvedOut 'fabric-artifact-retirement-board.json'
    deploymentPipelineGate = Join-Path $resolvedOut 'fabric-deployment-pipeline-gate.json'
    certifiedDatasetReadiness = Join-Path $resolvedOut 'fabric-certified-dataset-readiness.json'
    releaseEvidencePack = Join-Path $resolvedOut 'fabric-release-evidence-pack/summary.json'
    promotionRiskSimulator = Join-Path $resolvedOut 'fabric-promotion-risk-simulator.json'
    devTestProdDrift = Join-Path $resolvedOut 'fabric-dev-test-prod-drift.json'
    refreshFailureRootCause = Join-Path $resolvedOut 'fabric-refresh-failure-root-cause.json'
    capacityHotspotAnalyzer = Join-Path $resolvedOut 'fabric-capacity-hotspot-analyzer.json'
    gatewayRiskReview = Join-Path $resolvedOut 'fabric-gateway-risk-review.json'
    refreshSlaMonitor = Join-Path $resolvedOut 'fabric-refresh-sla-monitor.json'
    incidentTimeline = Join-Path $resolvedOut 'fabric-incident-timeline.json'
    lineageEvidenceGraph = Join-Path $resolvedOut 'fabric-lineage-evidence-graph.json'
    sensitivityLabelCoverage = Join-Path $resolvedOut 'fabric-sensitivity-label-coverage.json'
    sharingExposure = Join-Path $resolvedOut 'fabric-sharing-exposure.json'
    rlsServiceEvidence = Join-Path $resolvedOut 'fabric-rls-service-evidence.json'
    auditEvidenceMap = Join-Path $resolvedOut 'fabric-audit-evidence-map.json'
    executiveWarRoom = Join-Path $resolvedOut 'fabric-executive-war-room.json'
    boardBrief = Join-Path $resolvedOut 'fabric-board-brief.json'
    cfoRiskBrief = Join-Path $resolvedOut 'fabric-cfo-risk-brief.json'
    dataProductScorecard = Join-Path $resolvedOut 'fabric-data-product-scorecard.json'
    trustNarrative = Join-Path $resolvedOut 'fabric-trust-narrative.json'
}
if ($fabricSnapshotDirectory -and $IncludeFabricPortfolioQa) {
    & (Join-Path $scriptRoot 'New-PowerBIFabricPortfolioCommandCenter.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.portfolioCommandCenter -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricTenantHygieneScanner.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.tenantHygieneScanner -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricCostToTrustOptimizer.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.costToTrustOptimizer -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricWorkspaceRiskRadar.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.workspaceRiskRadar -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricArtifactRetirementBoard.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.artifactRetirementBoard -Json | Out-Null
}
if ($fabricSnapshotDirectory -and $IncludeFabricDeploymentQa) {
    & (Join-Path $scriptRoot 'Test-PowerBIFabricDeploymentPipelineGate.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.deploymentPipelineGate -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIFabricCertifiedDatasetReadiness.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.certifiedDatasetReadiness -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricReleaseEvidencePack.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputDirectory (Join-Path $resolvedOut 'fabric-release-evidence-pack') -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricPromotionRiskSimulator.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.promotionRiskSimulator -Json | Out-Null
    & (Join-Path $scriptRoot 'Compare-PowerBIFabricDevTestProdDrift.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.devTestProdDrift -Json | Out-Null
}
if ($fabricSnapshotDirectory -and $IncludeFabricOperationsQa) {
    & (Join-Path $scriptRoot 'New-PowerBIFabricRefreshFailureRootCauseAdvisor.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.refreshFailureRootCause -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricCapacityHotspotAnalyzer.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.capacityHotspotAnalyzer -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricGatewayRiskReview.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.gatewayRiskReview -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricRefreshSlaMonitor.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.refreshSlaMonitor -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricIncidentTimeline.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.incidentTimeline -Json | Out-Null
}
if ($fabricSnapshotDirectory -and $IncludeFabricGovernanceQa) {
    & (Join-Path $scriptRoot 'New-PowerBIFabricLineageEvidenceGraph.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.lineageEvidenceGraph -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIFabricSensitivityLabelCoverage.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.sensitivityLabelCoverage -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIFabricSharingExposure.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.sharingExposure -Json | Out-Null
    & (Join-Path $scriptRoot 'Test-PowerBIFabricRlsServiceEvidence.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.rlsServiceEvidence -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricAuditEvidenceMap.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.auditEvidenceMap -Json | Out-Null
}
if ($fabricSnapshotDirectory -and $IncludeFabricExecutiveQa) {
    & (Join-Path $scriptRoot 'New-PowerBIFabricExecutiveWarRoom.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.executiveWarRoom -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricBoardBrief.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.boardBrief -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricCfoRiskBrief.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.cfoRiskBrief -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricDataProductScorecard.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.dataProductScorecard -Json | Out-Null
    & (Join-Path $scriptRoot 'New-PowerBIFabricTrustNarrative.ps1') -SnapshotDirectory $fabricSnapshotDirectory -OutputPath $fabricArtifacts.trustNarrative -Json | Out-Null
}
& (Join-Path $scriptRoot 'New-PowerBIPRReleaseComment.ps1') -Path $Path -OutputPath (Join-Path $resolvedOut 'pr-release-comment.md') | Out-Null

$semantic = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'semantic-tests.json') | ConvertFrom-Json
$pbipStructure = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'pbip-structure.json') | ConvertFrom-Json
$releaseGate = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'trust-release-gate.json') | ConvertFrom-Json
$trustDebt = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'trust-debt-ledger.json') | ConvertFrom-Json
$capacityRisk = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'fabric-capacity-risk.json') | ConvertFrom-Json
$rlsLeakage = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'rls-leakage.json') | ConvertFrom-Json
$usageTrust = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'usage-trust-matrix.json') | ConvertFrom-Json
$rollbackReadiness = Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'pbip-rollback-readiness.json') | ConvertFrom-Json
$businessProcessDq = if ($IncludeBusinessProcessDQ) { Get-Content -Raw -LiteralPath (Join-Path $resolvedOut 'business-process-dq/summary.json') | ConvertFrom-Json } else { $null }
$analyticalMethodology = if (Test-Path -LiteralPath $analyticalMethodologyPath) { Get-Content -Raw -LiteralPath $analyticalMethodologyPath | ConvertFrom-Json } else { $null }
$analyticalDiagnosis = if (Test-Path -LiteralPath $analyticalDiagnosisPath) { Get-Content -Raw -LiteralPath $analyticalDiagnosisPath | ConvertFrom-Json } else { $null }
$evidenceGraph = if (Test-Path -LiteralPath $advancedUspArtifacts.evidenceGraph) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.evidenceGraph | ConvertFrom-Json } else { $null }
$semanticContract = if (Test-Path -LiteralPath $advancedUspArtifacts.semanticContract) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.semanticContract | ConvertFrom-Json } else { $null }
$executiveTrustBrief = if (Test-Path -LiteralPath $advancedUspArtifacts.executiveTrustBrief) { 'Available' } else { 'NotRun' }
$daxChangeRisk = if (Test-Path -LiteralPath $advancedUspArtifacts.daxChangeRisk) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.daxChangeRisk | ConvertFrom-Json } else { $null }
$dataFreshnessLineage = if (Test-Path -LiteralPath $advancedUspArtifacts.dataFreshnessLineage) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.dataFreshnessLineage | ConvertFrom-Json } else { $null }
$kpiDriftWatchlist = if (Test-Path -LiteralPath $advancedUspArtifacts.kpiDriftWatchlist) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.kpiDriftWatchlist | ConvertFrom-Json } else { $null }
$rlsTrustReview = if (Test-Path -LiteralPath $advancedUspArtifacts.rlsTrustReview) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.rlsTrustReview | ConvertFrom-Json } else { $null }
$reportUxRegression = if (Test-Path -LiteralPath $advancedUspArtifacts.reportUxRegression) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.reportUxRegression | ConvertFrom-Json } else { $null }
$migrationReadiness = if (Test-Path -LiteralPath $advancedUspArtifacts.migrationReadiness) { Get-Content -Raw -LiteralPath $advancedUspArtifacts.migrationReadiness | ConvertFrom-Json } else { $null }
$portfolioCommandCenter = if (Test-Path -LiteralPath $portfolioArtifacts.portfolioCommandCenter) { Get-Content -Raw -LiteralPath $portfolioArtifacts.portfolioCommandCenter | ConvertFrom-Json } else { $null }
$costToTrustOptimizer = if (Test-Path -LiteralPath $portfolioArtifacts.costToTrustOptimizer) { Get-Content -Raw -LiteralPath $portfolioArtifacts.costToTrustOptimizer | ConvertFrom-Json } else { $null }
$tenantHygieneScanner = if (Test-Path -LiteralPath $portfolioArtifacts.tenantHygieneScanner) { Get-Content -Raw -LiteralPath $portfolioArtifacts.tenantHygieneScanner | ConvertFrom-Json } else { $null }
$kpiDefinitionConflictResolution = if (Test-Path -LiteralPath $portfolioArtifacts.kpiDefinitionConflictResolution) { Get-Content -Raw -LiteralPath $portfolioArtifacts.kpiDefinitionConflictResolution | ConvertFrom-Json } else { $null }
$deploymentPipelineGate = if (Test-Path -LiteralPath $complianceArtifacts.deploymentPipelineGate) { Get-Content -Raw -LiteralPath $complianceArtifacts.deploymentPipelineGate | ConvertFrom-Json } else { $null }
$certifiedDatasetReadiness = if (Test-Path -LiteralPath $complianceArtifacts.certifiedDatasetReadiness) { Get-Content -Raw -LiteralPath $complianceArtifacts.certifiedDatasetReadiness | ConvertFrom-Json } else { $null }
$reportAccessibilityCompliance = if (Test-Path -LiteralPath $complianceArtifacts.reportAccessibilityCompliance) { Get-Content -Raw -LiteralPath $complianceArtifacts.reportAccessibilityCompliance | ConvertFrom-Json } else { $null }
$powerQueryDataContract = if (Test-Path -LiteralPath $complianceArtifacts.powerQueryDataContract) { Get-Content -Raw -LiteralPath $complianceArtifacts.powerQueryDataContract | ConvertFrom-Json } else { $null }
$releaseEvidenceSignature = if (Test-Path -LiteralPath $complianceArtifacts.releaseEvidenceSignature) { Get-Content -Raw -LiteralPath $complianceArtifacts.releaseEvidenceSignature | ConvertFrom-Json } else { $null }
$refreshFailureRootCause = if (Test-Path -LiteralPath $operationsArtifacts.refreshFailureRootCause) { Get-Content -Raw -LiteralPath $operationsArtifacts.refreshFailureRootCause | ConvertFrom-Json } else { $null }
$semanticTestCoverageScore = if (Test-Path -LiteralPath $operationsArtifacts.semanticTestCoverageScore) { Get-Content -Raw -LiteralPath $operationsArtifacts.semanticTestCoverageScore | ConvertFrom-Json } else { $null }
$businessKpiSlaMonitor = if (Test-Path -LiteralPath $operationsArtifacts.businessKpiSlaMonitor) { Get-Content -Raw -LiteralPath $operationsArtifacts.businessKpiSlaMonitor | ConvertFrom-Json } else { $null }
$fabricAccessPlan = if (Test-Path -LiteralPath $fabricAccessPlanPath) { Get-Content -Raw -LiteralPath $fabricAccessPlanPath | ConvertFrom-Json } else { $null }
$fabricWorkspaceSnapshot = if (Test-Path -LiteralPath $fabricWorkspaceSnapshotSummaryPath) { Get-Content -Raw -LiteralPath $fabricWorkspaceSnapshotSummaryPath | ConvertFrom-Json } else { $null }
$fabricPortfolio = if (Test-Path -LiteralPath $fabricArtifacts.portfolioCommandCenter) { Get-Content -Raw -LiteralPath $fabricArtifacts.portfolioCommandCenter | ConvertFrom-Json } else { $null }
$fabricTenantHygiene = if (Test-Path -LiteralPath $fabricArtifacts.tenantHygieneScanner) { Get-Content -Raw -LiteralPath $fabricArtifacts.tenantHygieneScanner | ConvertFrom-Json } else { $null }
$fabricCostToTrust = if (Test-Path -LiteralPath $fabricArtifacts.costToTrustOptimizer) { Get-Content -Raw -LiteralPath $fabricArtifacts.costToTrustOptimizer | ConvertFrom-Json } else { $null }
$fabricWorkspaceRisk = if (Test-Path -LiteralPath $fabricArtifacts.workspaceRiskRadar) { Get-Content -Raw -LiteralPath $fabricArtifacts.workspaceRiskRadar | ConvertFrom-Json } else { $null }
$fabricRetirement = if (Test-Path -LiteralPath $fabricArtifacts.artifactRetirementBoard) { Get-Content -Raw -LiteralPath $fabricArtifacts.artifactRetirementBoard | ConvertFrom-Json } else { $null }
$fabricDeployment = if (Test-Path -LiteralPath $fabricArtifacts.deploymentPipelineGate) { Get-Content -Raw -LiteralPath $fabricArtifacts.deploymentPipelineGate | ConvertFrom-Json } else { $null }
$fabricCertified = if (Test-Path -LiteralPath $fabricArtifacts.certifiedDatasetReadiness) { Get-Content -Raw -LiteralPath $fabricArtifacts.certifiedDatasetReadiness | ConvertFrom-Json } else { $null }
$fabricReleaseEvidence = if (Test-Path -LiteralPath $fabricArtifacts.releaseEvidencePack) { Get-Content -Raw -LiteralPath $fabricArtifacts.releaseEvidencePack | ConvertFrom-Json } else { $null }
$fabricPromotionRisk = if (Test-Path -LiteralPath $fabricArtifacts.promotionRiskSimulator) { Get-Content -Raw -LiteralPath $fabricArtifacts.promotionRiskSimulator | ConvertFrom-Json } else { $null }
$fabricDrift = if (Test-Path -LiteralPath $fabricArtifacts.devTestProdDrift) { Get-Content -Raw -LiteralPath $fabricArtifacts.devTestProdDrift | ConvertFrom-Json } else { $null }
$fabricRefreshRootCause = if (Test-Path -LiteralPath $fabricArtifacts.refreshFailureRootCause) { Get-Content -Raw -LiteralPath $fabricArtifacts.refreshFailureRootCause | ConvertFrom-Json } else { $null }
$fabricCapacityHotspot = if (Test-Path -LiteralPath $fabricArtifacts.capacityHotspotAnalyzer) { Get-Content -Raw -LiteralPath $fabricArtifacts.capacityHotspotAnalyzer | ConvertFrom-Json } else { $null }
$fabricGatewayRisk = if (Test-Path -LiteralPath $fabricArtifacts.gatewayRiskReview) { Get-Content -Raw -LiteralPath $fabricArtifacts.gatewayRiskReview | ConvertFrom-Json } else { $null }
$fabricRefreshSla = if (Test-Path -LiteralPath $fabricArtifacts.refreshSlaMonitor) { Get-Content -Raw -LiteralPath $fabricArtifacts.refreshSlaMonitor | ConvertFrom-Json } else { $null }
$fabricIncidentTimeline = if (Test-Path -LiteralPath $fabricArtifacts.incidentTimeline) { Get-Content -Raw -LiteralPath $fabricArtifacts.incidentTimeline | ConvertFrom-Json } else { $null }
$fabricLineageGraph = if (Test-Path -LiteralPath $fabricArtifacts.lineageEvidenceGraph) { Get-Content -Raw -LiteralPath $fabricArtifacts.lineageEvidenceGraph | ConvertFrom-Json } else { $null }
$fabricSensitivity = if (Test-Path -LiteralPath $fabricArtifacts.sensitivityLabelCoverage) { Get-Content -Raw -LiteralPath $fabricArtifacts.sensitivityLabelCoverage | ConvertFrom-Json } else { $null }
$fabricSharing = if (Test-Path -LiteralPath $fabricArtifacts.sharingExposure) { Get-Content -Raw -LiteralPath $fabricArtifacts.sharingExposure | ConvertFrom-Json } else { $null }
$fabricRls = if (Test-Path -LiteralPath $fabricArtifacts.rlsServiceEvidence) { Get-Content -Raw -LiteralPath $fabricArtifacts.rlsServiceEvidence | ConvertFrom-Json } else { $null }
$fabricAudit = if (Test-Path -LiteralPath $fabricArtifacts.auditEvidenceMap) { Get-Content -Raw -LiteralPath $fabricArtifacts.auditEvidenceMap | ConvertFrom-Json } else { $null }
$fabricExecutive = if (Test-Path -LiteralPath $fabricArtifacts.executiveWarRoom) { Get-Content -Raw -LiteralPath $fabricArtifacts.executiveWarRoom | ConvertFrom-Json } else { $null }
$fabricBoard = if (Test-Path -LiteralPath $fabricArtifacts.boardBrief) { Get-Content -Raw -LiteralPath $fabricArtifacts.boardBrief | ConvertFrom-Json } else { $null }
$fabricCfo = if (Test-Path -LiteralPath $fabricArtifacts.cfoRiskBrief) { Get-Content -Raw -LiteralPath $fabricArtifacts.cfoRiskBrief | ConvertFrom-Json } else { $null }
$fabricDataProduct = if (Test-Path -LiteralPath $fabricArtifacts.dataProductScorecard) { Get-Content -Raw -LiteralPath $fabricArtifacts.dataProductScorecard | ConvertFrom-Json } else { $null }
$fabricTrustNarrative = if (Test-Path -LiteralPath $fabricArtifacts.trustNarrative) { Get-Content -Raw -LiteralPath $fabricArtifacts.trustNarrative | ConvertFrom-Json } else { $null }
$unifiedErrorCount = if (Test-Path -LiteralPath $unifiedErrorLog) { @((Get-Content -LiteralPath $unifiedErrorLog -ErrorAction SilentlyContinue) | Where-Object { $_ }).Count } else { 0 }
$maxAiErrorCount = if (Test-Path -LiteralPath $maxAiErrorLog) { @((Get-Content -LiteralPath $maxAiErrorLog -ErrorAction SilentlyContinue) | Where-Object { $_ }).Count } else { 0 }

$summary = [pscustomobject]@{
    schema = 'codex.powerbi.releaseCandidatePack.v1'
    generated = (Get-Date).ToString('s')
    source = (Resolve-Path -LiteralPath $Path).Path
    outputDirectory = $resolvedOut
    unifiedReview = $unified.Index
    unifiedReviewErrorLog = if ($unifiedErrorCount -gt 0) { $unifiedErrorLog } else { $null }
    unifiedReviewErrorCount = $unifiedErrorCount
    maxAiReview = $maxAi.Index
    maxAiReviewErrorLog = if ($maxAiErrorCount -gt 0) { $maxAiErrorLog } else { $null }
    maxAiReviewErrorCount = $maxAiErrorCount
    decision = $releaseGate.decision
    gate = [pscustomobject]@{
        decision = $releaseGate.decision
        failCount = $releaseGate.failCount
        warnCount = $releaseGate.warnCount
        openP0Count = $releaseGate.openP0Count
        openP1Count = $releaseGate.openP1Count
        pendingSemanticTestCount = $releaseGate.pendingSemanticTestCount
        liveStatus = $releaseGate.liveStatus
        blockingReasons = $releaseGate.blockingReasons
        warnings = $releaseGate.warnings
    }
    validation = [pscustomobject]@{
        semanticTestCount = $semantic.testCount
        semanticFailedCount = $semantic.failedCount
        pendingSemanticTestCount = @($semantic.tests | Where-Object { $_.result -in @('PendingLiveDax', 'NotRun') -or $_.status -eq 'Generated' }).Count
        pbipRoundtripStatus = $pbipStructure.roundtripStatus
        pbipReadiness = $pbipStructure.readiness
        liveStatus = $unified.LiveStatus
    }
    enterpriseUsps = [pscustomobject]@{
        trustDebtReleaseBlockerCount = $trustDebt.releaseBlockerCount
        fabricCapacityRiskLevel = $capacityRisk.capacityRiskLevel
        rlsHighRiskCount = $rlsLeakage.highRiskCount
        usageTrustPriority = $usageTrust.priority
        rollbackReadinessStatus = $rollbackReadiness.status
        businessProcessDqStatus = if ($businessProcessDq) { $businessProcessDq.status } else { 'NotRun' }
        businessProcessDqHighCount = if ($businessProcessDq) { $businessProcessDq.highCount } else { 0 }
        analyticalQaStatus = if ($analyticalMethodology) { $analyticalMethodology.assessment } else { 'NotRun' }
        analyticalQaFindingCount = if ($analyticalMethodology) { $analyticalMethodology.findingCount } else { 0 }
        metricDiagnosisStatus = if ($analyticalDiagnosis) { $analyticalDiagnosis.status } else { 'NotRun' }
        evidenceGraphStrength = if ($evidenceGraph) { $evidenceGraph.evidenceStrength } else { 'NotRun' }
        semanticContractStatus = if ($semanticContract) { $semanticContract.status } else { 'NotRun' }
        executiveTrustBriefStatus = $executiveTrustBrief
        daxHighRiskMetricCount = if ($daxChangeRisk) { $daxChangeRisk.highRiskMetricCount } else { 0 }
        dataFreshnessLineageStatus = if ($dataFreshnessLineage) { $dataFreshnessLineage.status } else { 'NotRun' }
        kpiDriftHighPriorityCount = if ($kpiDriftWatchlist) { $kpiDriftWatchlist.highPriorityCount } else { 0 }
        rlsTrustReviewStatus = if ($rlsTrustReview) { $rlsTrustReview.status } else { 'NotRun' }
        reportUxRegressionStatus = if ($reportUxRegression) { $reportUxRegression.status } else { 'NotRun' }
        migrationReadinessStatus = if ($migrationReadiness) { $migrationReadiness.status } else { 'NotRun' }
        portfolioCommandCenterStatus = if ($portfolioCommandCenter) { $portfolioCommandCenter.status } else { 'NotRun' }
        costToTrustHighPriorityCount = if ($costToTrustOptimizer) { $costToTrustOptimizer.highPriorityCount } else { 0 }
        tenantHygieneStatus = if ($tenantHygieneScanner) { $tenantHygieneScanner.status } else { 'NotRun' }
        kpiDefinitionConflictStatus = if ($kpiDefinitionConflictResolution) { $kpiDefinitionConflictResolution.status } else { 'NotRun' }
        deploymentPipelineDecision = if ($deploymentPipelineGate) { $deploymentPipelineGate.decision } else { 'NotRun' }
        certifiedDatasetReadinessStatus = if ($certifiedDatasetReadiness) { $certifiedDatasetReadiness.status } else { 'NotRun' }
        accessibilityComplianceStatus = if ($reportAccessibilityCompliance) { $reportAccessibilityCompliance.status } else { 'NotRun' }
        powerQueryDataContractStatus = if ($powerQueryDataContract) { $powerQueryDataContract.status } else { 'NotRun' }
        releaseEvidenceSignatureStatus = if ($releaseEvidenceSignature) { 'Available' } else { 'NotRun' }
        refreshFailureRootCauseStatus = if ($refreshFailureRootCause) { $refreshFailureRootCause.status } else { 'NotRun' }
        semanticTestCoverageStatus = if ($semanticTestCoverageScore) { $semanticTestCoverageScore.status } else { 'NotRun' }
        businessKpiSlaBreachedCount = if ($businessKpiSlaMonitor) { $businessKpiSlaMonitor.breachedCount } else { 0 }
        nextGenUspArtifactCount = if ($nextGenUspPack) { $nextGenUspPack.artifactCount } else { 0 }
        kpiSloActionRequiredCount = if ($kpiSloActionList) { $kpiSloActionList.actionRequiredCount } else { 0 }
        kpiSloNeedsOwnerSetupCount = if ($kpiSloActionList) { $kpiSloActionList.needsOwnerSetupCount } else { 0 }
        enterpriseOperationsArtifactCount = if ($enterpriseOperations) { $enterpriseOperations.artifactCount } else { 0 }
        decisionIntelligenceArtifactCount = if ($decisionIntelligence) { $decisionIntelligence.artifactCount } else { 0 }
        fabricLiveStatus = if ($fabricWorkspaceSnapshot) { $fabricWorkspaceSnapshot.status } elseif ($fabricAccessPlan) { $fabricAccessPlan.status } else { 'NotRun' }
        fabricWorkspaceSnapshotStatus = if ($fabricWorkspaceSnapshot) { $fabricWorkspaceSnapshot.status } else { 'NotRun' }
        fabricPortfolioStatus = if ($fabricPortfolio) { $fabricPortfolio.status } else { 'NotRun' }
        fabricTenantHygieneStatus = if ($fabricTenantHygiene) { $fabricTenantHygiene.status } else { 'NotRun' }
        fabricCostToTrustHighPriorityCount = if ($fabricCostToTrust) { $fabricCostToTrust.highPriorityCount } else { 0 }
        fabricWorkspaceRiskStatus = if ($fabricWorkspaceRisk) { $fabricWorkspaceRisk.status } else { 'NotRun' }
        fabricRetirementCandidateCount = if ($fabricRetirement) { $fabricRetirement.candidateCount } else { 0 }
        fabricDeploymentDecision = if ($fabricDeployment) { $fabricDeployment.decision } else { 'NotRun' }
        fabricCertifiedDatasetStatus = if ($fabricCertified) { $fabricCertified.status } else { 'NotRun' }
        fabricReleaseEvidenceStatus = if ($fabricReleaseEvidence) { $fabricReleaseEvidence.status } else { 'NotRun' }
        fabricPromotionRiskStatus = if ($fabricPromotionRisk) { $fabricPromotionRisk.status } else { 'NotRun' }
        fabricDevTestProdDriftStatus = if ($fabricDrift) { $fabricDrift.status } else { 'NotRun' }
        fabricRefreshRiskStatus = if ($fabricRefreshRootCause) { $fabricRefreshRootCause.status } else { 'NotRun' }
        fabricCapacityHotspotStatus = if ($fabricCapacityHotspot) { $fabricCapacityHotspot.status } else { 'NotRun' }
        fabricGatewayRiskStatus = if ($fabricGatewayRisk) { $fabricGatewayRisk.status } else { 'NotRun' }
        fabricRefreshSlaStatus = if ($fabricRefreshSla) { $fabricRefreshSla.status } else { 'NotRun' }
        fabricIncidentTimelineStatus = if ($fabricIncidentTimeline) { $fabricIncidentTimeline.status } else { 'NotRun' }
        fabricLineageEvidenceStrength = if ($fabricLineageGraph) { $fabricLineageGraph.evidenceStrength } else { 'NotRun' }
        fabricSensitivityLabelStatus = if ($fabricSensitivity) { $fabricSensitivity.status } else { 'NotRun' }
        fabricSharingExposureStatus = if ($fabricSharing) { $fabricSharing.status } else { 'NotRun' }
        fabricRlsServiceEvidenceStatus = if ($fabricRls) { $fabricRls.status } else { 'NotRun' }
        fabricAuditEvidenceStatus = if ($fabricAudit) { $fabricAudit.status } else { 'NotRun' }
        fabricExecutiveWarRoomStatus = if ($fabricExecutive) { $fabricExecutive.status } else { 'NotRun' }
        fabricBoardBriefStatus = if ($fabricBoard) { $fabricBoard.status } else { 'NotRun' }
        fabricCfoRiskStatus = if ($fabricCfo) { $fabricCfo.status } else { 'NotRun' }
        fabricDataProductScorecardStatus = if ($fabricDataProduct) { $fabricDataProduct.status } else { 'NotRun' }
        fabricTrustNarrativeStatus = if ($fabricTrustNarrative) { $fabricTrustNarrative.status } else { 'NotRun' }
    }
}
$summaryPath = Join-Path $resolvedOut 'summary.json'
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

$index = @(
    '# Power BI Release Candidate Pack',
    '',
    ('Source: `{0}`' -f $summary.source),
    "Generated: $($summary.generated)",
    '',
    '## Artifacts',
    ('- Unified review: `{0}`' -f $unified.Index),
    ('- Unified review error log: `{0}`' -f $(if ($unifiedErrorCount -gt 0) { $unifiedErrorLog } else { 'none' })),
    ('- Max AI review: `{0}`' -f $maxAi.Index),
    ('- Max AI review error log: `{0}`' -f $(if ($maxAiErrorCount -gt 0) { $maxAiErrorLog } else { 'none' })),
    ('- Service scanner: `{0}`' -f (Join-Path $resolvedOut 'service-scanner.json')),
    ('- Model risk heatmap: `{0}`' -f (Join-Path $resolvedOut 'model-risk-heatmap.json')),
    ('- Semantic tests: `{0}`' -f (Join-Path $resolvedOut 'semantic-tests.json')),
    ('- PBIP structure: `{0}`' -f (Join-Path $resolvedOut 'pbip-structure.json')),
    ('- Governance policy pack: `{0}`' -f (Join-Path $resolvedOut 'governance-policy-pack.json')),
    ('- Trust release gate: `{0}`' -f (Join-Path $resolvedOut 'trust-release-gate.json')),
    ('- Trust debt ledger: `{0}`' -f (Join-Path $resolvedOut 'trust-debt-ledger.json')),
    ('- Fabric capacity risk forecast: `{0}`' -f (Join-Path $resolvedOut 'fabric-capacity-risk.json')),
    ('- RLS leakage checks: `{0}`' -f (Join-Path $resolvedOut 'rls-leakage.json')),
    ('- Usage trust matrix: `{0}`' -f (Join-Path $resolvedOut 'usage-trust-matrix.json')),
    ('- PBIP rollback readiness: `{0}`' -f (Join-Path $resolvedOut 'pbip-rollback-readiness.json')),
    ('- Business process DQ: `{0}`' -f $(if ($IncludeBusinessProcessDQ) { Join-Path $resolvedOut 'business-process-dq/summary.json' } else { 'not requested' })),
    ('- Analysis methodology validation: `{0}`' -f $(if (Test-Path -LiteralPath $analyticalMethodologyPath) { $analyticalMethodologyPath } else { 'not requested' })),
    ('- Metric change diagnosis: `{0}`' -f $(if (Test-Path -LiteralPath $analyticalDiagnosisPath) { $analyticalDiagnosisPath } else { 'not requested' })),
    ('- Analytical release report: `{0}`' -f $(if (Test-Path -LiteralPath $analyticalReportPath) { $analyticalReportPath } else { 'not requested' })),
    ('- Evidence graph: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.evidenceGraph) { $advancedUspArtifacts.evidenceGraph } else { 'not requested' })),
    ('- Visual-to-measure impact: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.visualMeasureImpact) { $advancedUspArtifacts.visualMeasureImpact } else { 'not requested' })),
    ('- Semantic contract test: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.semanticContract) { $advancedUspArtifacts.semanticContract } else { 'not requested' })),
    ('- Executive trust brief: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.executiveTrustBrief) { $advancedUspArtifacts.executiveTrustBrief } else { 'not requested' })),
    ('- DAX change risk classifier: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.daxChangeRisk) { $advancedUspArtifacts.daxChangeRisk } else { 'not requested' })),
    ('- Data freshness and lineage gate: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.dataFreshnessLineage) { $advancedUspArtifacts.dataFreshnessLineage } else { 'not requested' })),
    ('- KPI drift watchlist: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.kpiDriftWatchlist) { $advancedUspArtifacts.kpiDriftWatchlist } else { 'not requested' })),
    ('- RLS trust review: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.rlsTrustReview) { $advancedUspArtifacts.rlsTrustReview } else { 'not requested' })),
    ('- Report UX regression scanner: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.reportUxRegression) { $advancedUspArtifacts.reportUxRegression } else { 'not requested' })),
    ('- Migration readiness: `{0}`' -f $(if (Test-Path -LiteralPath $advancedUspArtifacts.migrationReadiness) { $advancedUspArtifacts.migrationReadiness } else { 'not requested' })),
    ('- Portfolio command center: `{0}`' -f $(if (Test-Path -LiteralPath $portfolioArtifacts.portfolioCommandCenter) { $portfolioArtifacts.portfolioCommandCenter } else { 'not requested' })),
    ('- Cost-to-trust optimizer: `{0}`' -f $(if (Test-Path -LiteralPath $portfolioArtifacts.costToTrustOptimizer) { $portfolioArtifacts.costToTrustOptimizer } else { 'not requested' })),
    ('- Tenant hygiene scanner: `{0}`' -f $(if (Test-Path -LiteralPath $portfolioArtifacts.tenantHygieneScanner) { $portfolioArtifacts.tenantHygieneScanner } else { 'not requested' })),
    ('- KPI definition conflict resolution: `{0}`' -f $(if (Test-Path -LiteralPath $portfolioArtifacts.kpiDefinitionConflictResolution) { $portfolioArtifacts.kpiDefinitionConflictResolution } else { 'not requested' })),
    ('- Deployment pipeline gate: `{0}`' -f $(if (Test-Path -LiteralPath $complianceArtifacts.deploymentPipelineGate) { $complianceArtifacts.deploymentPipelineGate } else { 'not requested' })),
    ('- Certified dataset readiness: `{0}`' -f $(if (Test-Path -LiteralPath $complianceArtifacts.certifiedDatasetReadiness) { $complianceArtifacts.certifiedDatasetReadiness } else { 'not requested' })),
    ('- Report accessibility compliance: `{0}`' -f $(if (Test-Path -LiteralPath $complianceArtifacts.reportAccessibilityCompliance) { $complianceArtifacts.reportAccessibilityCompliance } else { 'not requested' })),
    ('- Power Query data contract: `{0}`' -f $(if (Test-Path -LiteralPath $complianceArtifacts.powerQueryDataContract) { $complianceArtifacts.powerQueryDataContract } else { 'not requested' })),
    ('- Release evidence signature: `{0}`' -f $(if (Test-Path -LiteralPath $complianceArtifacts.releaseEvidenceSignature) { $complianceArtifacts.releaseEvidenceSignature } else { 'not requested' })),
    ('- Refresh failure root cause: `{0}`' -f $(if (Test-Path -LiteralPath $operationsArtifacts.refreshFailureRootCause) { $operationsArtifacts.refreshFailureRootCause } else { 'not requested' })),
    ('- Semantic test coverage score: `{0}`' -f $(if (Test-Path -LiteralPath $operationsArtifacts.semanticTestCoverageScore) { $operationsArtifacts.semanticTestCoverageScore } else { 'not requested' })),
    ('- Business KPI SLA monitor: `{0}`' -f $(if (Test-Path -LiteralPath $operationsArtifacts.businessKpiSlaMonitor) { $operationsArtifacts.businessKpiSlaMonitor } else { 'not requested' })),
    ('- Next-generation USP pack: `{0}`' -f $(if (Test-Path -LiteralPath $nextGenUspSummaryPath) { $nextGenUspSummaryPath } else { 'not requested' })),
    ('- KPI SLO action list: `{0}`' -f $(if (Test-Path -LiteralPath $kpiSloActionListPath) { $kpiSloActionListPath } else { 'not requested' })),
    ('- Enterprise operations pack: `{0}`' -f $(if (Test-Path -LiteralPath $enterpriseOperationsSummaryPath) { $enterpriseOperationsSummaryPath } else { 'not requested' })),
    ('- Decision intelligence pack: `{0}`' -f $(if (Test-Path -LiteralPath $decisionIntelligenceSummaryPath) { $decisionIntelligenceSummaryPath } else { 'not requested' })),
    ('- Fabric access plan: `{0}`' -f $(if (Test-Path -LiteralPath $fabricAccessPlanPath) { $fabricAccessPlanPath } else { 'not requested' })),
    ('- Fabric workspace snapshot: `{0}`' -f $(if (Test-Path -LiteralPath $fabricWorkspaceSnapshotSummaryPath) { $fabricWorkspaceSnapshotSummaryPath } else { 'not requested' })),
    ('- Fabric portfolio command center: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.portfolioCommandCenter) { $fabricArtifacts.portfolioCommandCenter } else { 'not requested' })),
    ('- Fabric tenant hygiene scanner: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.tenantHygieneScanner) { $fabricArtifacts.tenantHygieneScanner } else { 'not requested' })),
    ('- Fabric cost-to-trust optimizer: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.costToTrustOptimizer) { $fabricArtifacts.costToTrustOptimizer } else { 'not requested' })),
    ('- Fabric workspace risk radar: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.workspaceRiskRadar) { $fabricArtifacts.workspaceRiskRadar } else { 'not requested' })),
    ('- Fabric artifact retirement board: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.artifactRetirementBoard) { $fabricArtifacts.artifactRetirementBoard } else { 'not requested' })),
    ('- Fabric deployment pipeline gate: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.deploymentPipelineGate) { $fabricArtifacts.deploymentPipelineGate } else { 'not requested' })),
    ('- Fabric certified dataset readiness: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.certifiedDatasetReadiness) { $fabricArtifacts.certifiedDatasetReadiness } else { 'not requested' })),
    ('- Fabric release evidence pack: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.releaseEvidencePack) { $fabricArtifacts.releaseEvidencePack } else { 'not requested' })),
    ('- Fabric promotion risk simulator: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.promotionRiskSimulator) { $fabricArtifacts.promotionRiskSimulator } else { 'not requested' })),
    ('- Fabric Dev/Test/Prod drift: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.devTestProdDrift) { $fabricArtifacts.devTestProdDrift } else { 'not requested' })),
    ('- Fabric refresh failure root cause: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.refreshFailureRootCause) { $fabricArtifacts.refreshFailureRootCause } else { 'not requested' })),
    ('- Fabric capacity hotspot analyzer: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.capacityHotspotAnalyzer) { $fabricArtifacts.capacityHotspotAnalyzer } else { 'not requested' })),
    ('- Fabric gateway risk review: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.gatewayRiskReview) { $fabricArtifacts.gatewayRiskReview } else { 'not requested' })),
    ('- Fabric refresh SLA monitor: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.refreshSlaMonitor) { $fabricArtifacts.refreshSlaMonitor } else { 'not requested' })),
    ('- Fabric incident timeline: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.incidentTimeline) { $fabricArtifacts.incidentTimeline } else { 'not requested' })),
    ('- Fabric lineage evidence graph: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.lineageEvidenceGraph) { $fabricArtifacts.lineageEvidenceGraph } else { 'not requested' })),
    ('- Fabric sensitivity label coverage: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.sensitivityLabelCoverage) { $fabricArtifacts.sensitivityLabelCoverage } else { 'not requested' })),
    ('- Fabric sharing exposure: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.sharingExposure) { $fabricArtifacts.sharingExposure } else { 'not requested' })),
    ('- Fabric RLS service evidence: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.rlsServiceEvidence) { $fabricArtifacts.rlsServiceEvidence } else { 'not requested' })),
    ('- Fabric audit evidence map: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.auditEvidenceMap) { $fabricArtifacts.auditEvidenceMap } else { 'not requested' })),
    ('- Fabric executive war room: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.executiveWarRoom) { $fabricArtifacts.executiveWarRoom } else { 'not requested' })),
    ('- Fabric board brief: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.boardBrief) { $fabricArtifacts.boardBrief } else { 'not requested' })),
    ('- Fabric CFO risk brief: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.cfoRiskBrief) { $fabricArtifacts.cfoRiskBrief } else { 'not requested' })),
    ('- Fabric data product scorecard: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.dataProductScorecard) { $fabricArtifacts.dataProductScorecard } else { 'not requested' })),
    ('- Fabric trust narrative: `{0}`' -f $(if (Test-Path -LiteralPath $fabricArtifacts.trustNarrative) { $fabricArtifacts.trustNarrative } else { 'not requested' })),
    ('- PR release comment: `{0}`' -f (Join-Path $resolvedOut 'pr-release-comment.md')),
    ('- Summary: `{0}`' -f $summaryPath)
)
$indexPath = Join-Path $resolvedOut 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

[pscustomobject]@{
    OutputDirectory = $resolvedOut
    Index = $indexPath
    Summary = $summaryPath
}
