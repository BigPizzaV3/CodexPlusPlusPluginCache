param(
    [string]$PluginRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$samplePath = Join-Path $PluginRoot 'examples/sample-model'
$businessProcessDataPath = Join-Path $PluginRoot 'examples/business-process-data'
$scriptsPath = Join-Path $PluginRoot 'scripts'
$manifestPath = Join-Path $PluginRoot '.codex-plugin/plugin.json'

$results = New-Object System.Collections.Generic.List[object]

function Add-TestResult {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    $script:results.Add([pscustomobject]@{
        Name = $Name
        Passed = $Passed
        Detail = $Detail
    })
}

try {
    Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json | Out-Null
    Add-TestResult -Name 'Manifest JSON' -Passed $true -Detail 'plugin.json parses.'
}
catch {
    Add-TestResult -Name 'Manifest JSON' -Passed $false -Detail $_.Exception.Message
}

try {
    $live = & (Join-Path $scriptsPath 'Get-PowerBIDesktopLiveConnection.ps1') -Json | ConvertFrom-Json
    Add-TestResult -Name 'Live connection detection runs' -Passed ($null -ne $live.powerBIDesktopRunning) -Detail "PowerBIDesktopRunning=$($live.powerBIDesktopRunning)"
}
catch {
    Add-TestResult -Name 'Live connection detection runs' -Passed $false -Detail $_.Exception.Message
}

try {
    $requiredLiveScripts = @(
        'Invoke-PowerBILiveDaxQuery.ps1',
        'Test-PowerBILiveMeasures.ps1',
        'Test-PowerBILiveMetadataGovernance.ps1',
        'New-PowerBILiveRefactorSuggestions.ps1',
        'New-PowerBILiveFixBacklog.ps1',
        'New-PowerBILiveDaxFixDrafts.ps1',
        'Invoke-PowerBILiveAutoReview.ps1'
    )
    $missingLiveScripts = @($requiredLiveScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'Live AI scripts are present' -Passed ($missingLiveScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingLiveScripts -join ', '))
}
catch {
    Add-TestResult -Name 'Live AI scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $externalScripts = @(
        'Get-PowerBIExternalToolInventory.ps1',
        'New-PowerBIExternalToolCapabilityMatrix.ps1',
        'New-PowerBITabularEditorWorkflow.ps1',
        'New-PowerBIDaxStudioWorkflow.ps1',
        'New-PowerBIALMToolkitWorkflow.ps1',
        'New-PowerBIHelperWorkflow.ps1',
        'New-PowerBIPbiToolsWorkflow.ps1',
        'Invoke-PowerBIExternalToolsReview.ps1'
    )
    $missingExternalScripts = @($externalScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'External tool scripts are present' -Passed ($missingExternalScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingExternalScripts -join ', '))
}
catch {
    Add-TestResult -Name 'External tool scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $tools = & (Join-Path $scriptsPath 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json
    Add-TestResult -Name 'External tool inventory reports known tools' -Passed (@($tools.tools).Count -ge 7 -and ($tools.tools | Where-Object name -eq 'DAX Studio')) -Detail "Tools=$(@($tools.tools).Count)"
}
catch {
    Add-TestResult -Name 'External tool inventory reports known tools' -Passed $false -Detail $_.Exception.Message
}

try {
    $matrix = & (Join-Path $scriptsPath 'New-PowerBIExternalToolCapabilityMatrix.ps1') -Json | ConvertFrom-Json
    Add-TestResult -Name 'External tool capability matrix maps features' -Passed ($matrix.toolCount -ge 7 -and $matrix.capabilityCount -ge 8) -Detail "Tools=$($matrix.toolCount), Capabilities=$($matrix.capabilityCount)"
}
catch {
    Add-TestResult -Name 'External tool capability matrix maps features' -Passed $false -Detail $_.Exception.Message
}

try {
    $nativeScripts = @(
        'Invoke-PowerBINativeBpa.ps1',
        'Compare-PowerBINativeModel.ps1',
        'New-PowerBINativeModelDocumentation.ps1',
        'New-PowerBINativePerformanceProfile.ps1',
        'Test-PowerBIReportLayoutBestPractices.ps1',
        'New-PowerBIThemeAudit.ps1',
        'New-PowerBIPBIPSourceControlPlan.ps1',
        'Invoke-PowerBINativeToolParityReview.ps1'
    )
    $missingNativeScripts = @($nativeScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'Native tool capability scripts are present' -Passed ($missingNativeScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingNativeScripts -join ', '))
}
catch {
    Add-TestResult -Name 'Native tool capability scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $bpa = & (Join-Path $scriptsPath 'Invoke-PowerBINativeBpa.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Native BPA returns rule findings' -Passed ($bpa.ruleCount -ge 5 -and $bpa.findingCount -ge 1) -Detail "Rules=$($bpa.ruleCount), Findings=$($bpa.findingCount)"
}
catch {
    Add-TestResult -Name 'Native BPA returns rule findings' -Passed $false -Detail $_.Exception.Message
}

try {
    $doc = & (Join-Path $scriptsPath 'New-PowerBINativeModelDocumentation.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Native model documentation summarizes model' -Passed ($doc.metricCount -eq 5 -and $doc.sectionCount -ge 4) -Detail "Sections=$($doc.sectionCount)"
}
catch {
    Add-TestResult -Name 'Native model documentation summarizes model' -Passed $false -Detail $_.Exception.Message
}

try {
    $perf = & (Join-Path $scriptsPath 'New-PowerBINativePerformanceProfile.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Native performance profile estimates risk' -Passed ($perf.profileCount -eq 5 -and $perf.totalEstimatedRisk -ge 0) -Detail "Profiles=$($perf.profileCount)"
}
catch {
    Add-TestResult -Name 'Native performance profile estimates risk' -Passed $false -Detail $_.Exception.Message
}

try {
    $realFeatureScripts = @(
        'Test-PowerBIVisualSchema.ps1',
        'Test-PowerBIReportRenderReadiness.ps1',
        'Invoke-PowerBILiveDaxBenchmark.ps1',
        'Get-PowerBILiveVertiPaqAnalyzer.ps1',
        'New-PowerBICalculationGroupDraft.ps1',
        'New-PowerBIRelationshipDraft.ps1',
        'New-PowerBIRlsRoleDraft.ps1',
        'New-PowerBIPowerQueryDraft.ps1',
        'New-PowerBIServiceIntegrationPlan.ps1',
        'New-PowerBIIncrementalRefreshDraft.ps1',
        'New-PowerBIAggregationDraft.ps1',
        'New-PowerBISchemaAwareVisualPlan.ps1',
        'Invoke-PowerBIRealFeatureReview.ps1'
    )
    $missingRealFeatureScripts = @($realFeatureScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'Real feature scripts are present' -Passed ($missingRealFeatureScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingRealFeatureScripts -join ', '))
}
catch {
    Add-TestResult -Name 'Real feature scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $calcGroup = & (Join-Path $scriptsPath 'New-PowerBICalculationGroupDraft.ps1') -GroupName 'Time Intelligence' -BaseMeasure 'Total Sales' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Calculation group draft creates items' -Passed ($calcGroup.objectType -eq 'CalculationGroup' -and @($calcGroup.items).Count -ge 3) -Detail "Items=$(@($calcGroup.items).Count)"
}
catch {
    Add-TestResult -Name 'Calculation group draft creates items' -Passed $false -Detail $_.Exception.Message
}

try {
    $relationship = & (Join-Path $scriptsPath 'New-PowerBIRelationshipDraft.ps1') -FromTable 'Sales' -FromColumn 'DateKey' -ToTable 'Date' -ToColumn 'DateKey' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Relationship draft creates TMDL' -Passed ($relationship.objectType -eq 'Relationship' -and $relationship.tmdl -match 'relationship') -Detail $relationship.relationshipName
}
catch {
    Add-TestResult -Name 'Relationship draft creates TMDL' -Passed $false -Detail $_.Exception.Message
}

try {
    $mDraft = & (Join-Path $scriptsPath 'New-PowerBIPowerQueryDraft.ps1') -QueryName 'DimDate' -SourceKind 'DateTable' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Power Query draft creates M script' -Passed ($mDraft.objectType -eq 'PowerQuery' -and $mDraft.mCode -match 'let') -Detail $mDraft.queryName
}
catch {
    Add-TestResult -Name 'Power Query draft creates M script' -Passed $false -Detail $_.Exception.Message
}

try {
    $schemaVisual = & (Join-Path $scriptsPath 'New-PowerBISchemaAwareVisualPlan.ps1') -Path $samplePath -Measure 'Total Sales' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Schema-aware visual planner recommends visual' -Passed ($schemaVisual.recommendation.visualType -and $schemaVisual.measure -eq 'Total Sales') -Detail $schemaVisual.recommendation.visualType
}
catch {
    Add-TestResult -Name 'Schema-aware visual planner recommends visual' -Passed $false -Detail $_.Exception.Message
}

try {
    $realReview = & (Join-Path $scriptsPath 'Invoke-PowerBIRealFeatureReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/real-feature-review-test')
    $passed = (Test-Path -LiteralPath $realReview.Index) -and (Test-Path -LiteralPath (Join-Path $realReview.OutputDirectory 'visual-schema-check.json')) -and (Test-Path -LiteralPath (Join-Path $realReview.OutputDirectory 'service-integration-plan.md'))
    Add-TestResult -Name 'Real feature review creates package' -Passed $passed -Detail $realReview.OutputDirectory
}
catch {
    Add-TestResult -Name 'Real feature review creates package' -Passed $false -Detail $_.Exception.Message
}

try {
    $applyScripts = @(
        'Apply-PowerBIPBIPMeasureDraft.ps1',
        'Apply-PowerBIPBIPCalculatedColumnDraft.ps1',
        'Apply-PowerBIPBIPPowerQueryDraft.ps1',
        'Apply-PowerBIPBIPTmdlDraft.ps1',
        'Invoke-PowerBIPBIPApplyPlan.ps1'
    )
    $missingApplyScripts = @($applyScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'PBIP apply engine scripts are present' -Passed ($missingApplyScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingApplyScripts -join ', '))
}
catch {
    Add-TestResult -Name 'PBIP apply engine scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $applyRoot = Join-Path $PluginRoot 'tmp/pbip-apply-engine-test'
    $measureApply = & (Join-Path $scriptsPath 'Apply-PowerBIPBIPMeasureDraft.ps1') -PbipPath $applyRoot -TableName 'Sales' -MeasureName 'Average Sales' -Expression "DIVIDE([Total Sales], COUNTROWS('Sales'))" -Apply -Json | ConvertFrom-Json
    Add-TestResult -Name 'PBIP apply engine writes measure draft' -Passed ($measureApply.applied -eq $true -and (Test-Path -LiteralPath $measureApply.targetPath)) -Detail $measureApply.targetPath
}
catch {
    Add-TestResult -Name 'PBIP apply engine writes measure draft' -Passed $false -Detail $_.Exception.Message
}

try {
    $applyRoot = Join-Path $PluginRoot 'tmp/pbip-apply-engine-test'
    $queryApply = & (Join-Path $scriptsPath 'Apply-PowerBIPBIPPowerQueryDraft.ps1') -PbipPath $applyRoot -QueryName 'DimDate' -SourceKind 'DateTable' -Apply -Json | ConvertFrom-Json
    Add-TestResult -Name 'PBIP apply engine writes Power Query draft' -Passed ($queryApply.applied -eq $true -and (Test-Path -LiteralPath $queryApply.targetPath)) -Detail $queryApply.targetPath
}
catch {
    Add-TestResult -Name 'PBIP apply engine writes Power Query draft' -Passed $false -Detail $_.Exception.Message
}

try {
    $applyRoot = Join-Path $PluginRoot 'tmp/pbip-apply-engine-test'
    $plan = & (Join-Path $scriptsPath 'Invoke-PowerBIPBIPApplyPlan.ps1') -PbipPath $applyRoot -Json | ConvertFrom-Json
    Add-TestResult -Name 'PBIP apply plan summarizes applied drafts' -Passed ($plan.artifactCount -ge 2 -and @($plan.artifacts).Count -ge 2) -Detail "Artifacts=$($plan.artifactCount)"
}
catch {
    Add-TestResult -Name 'PBIP apply plan summarizes applied drafts' -Passed $false -Detail $_.Exception.Message
}

try {
    $structure = & (Join-Path $scriptsPath 'Get-PowerBIPBIPStructure.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'PBIP structure reports readiness' -Passed ($structure.score -ge 20) -Detail "Readiness=$($structure.readiness), Score=$($structure.score)"
}
catch {
    Add-TestResult -Name 'PBIP structure reports readiness' -Passed $false -Detail $_.Exception.Message
}

try {
    $scan = & (Join-Path $scriptsPath 'Invoke-PowerBIInsightScan.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Insight scan detects sample risks' -Passed ($scan.Findings.Count -ge 3 -and $scan.RiskScore -ge 6) -Detail "Findings=$($scan.Findings.Count), RiskScore=$($scan.RiskScore)"
}
catch {
    Add-TestResult -Name 'Insight scan detects sample risks' -Passed $false -Detail $_.Exception.Message
}

try {
    $catalog = & (Join-Path $scriptsPath 'New-PowerBIMetricCatalog.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Metric catalog extracts measures' -Passed ($catalog.metricCount -eq 5) -Detail "MetricCount=$($catalog.metricCount)"
}
catch {
    Add-TestResult -Name 'Metric catalog extracts measures' -Passed $false -Detail $_.Exception.Message
}

try {
    $graph = & (Join-Path $scriptsPath 'New-PowerBIDependencyGraph.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Dependency graph detects edges' -Passed ($graph.edgeCount -ge 2) -Detail "EdgeCount=$($graph.edgeCount)"
}
catch {
    Add-TestResult -Name 'Dependency graph detects edges' -Passed $false -Detail $_.Exception.Message
}

try {
    $plan = & (Join-Path $scriptsPath 'New-PowerBIRefactorPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Refactor plan creates items' -Passed ($plan.itemCount -ge 3) -Detail "ItemCount=$($plan.itemCount)"
}
catch {
    Add-TestResult -Name 'Refactor plan creates items' -Passed $false -Detail $_.Exception.Message
}

try {
    $pack = & (Join-Path $scriptsPath 'New-PowerBIAIPromptPack.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/ai-pack-test')
    Add-TestResult -Name 'AI prompt pack creates context' -Passed (Test-Path -LiteralPath (Join-Path $pack.OutputDirectory 'context-pack.json')) -Detail $pack.OutputDirectory
}
catch {
    Add-TestResult -Name 'AI prompt pack creates context' -Passed $false -Detail $_.Exception.Message
}

try {
    $review = & (Join-Path $scriptsPath 'Invoke-PowerBIAutoReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/auto-review-test')
    Add-TestResult -Name 'Auto review creates index' -Passed (Test-Path -LiteralPath $review.Index) -Detail $review.OutputDirectory
}
catch {
    Add-TestResult -Name 'Auto review creates index' -Passed $false -Detail $_.Exception.Message
}

try {
    $blueprint = & (Join-Path $scriptsPath 'New-PowerBIReportBlueprint.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Report blueprint creates pages' -Passed ($blueprint.pageCount -eq 3) -Detail "PageCount=$($blueprint.pageCount)"
}
catch {
    Add-TestResult -Name 'Report blueprint creates pages' -Passed $false -Detail $_.Exception.Message
}

try {
    $innovationScripts = @(
        'New-PowerBIGuidedFixPlan.ps1',
        'Compare-PowerBISemanticModel.ps1',
        'New-PowerBIMeasureLineageImpact.ps1',
        'New-PowerBIMeasureTestPlan.ps1',
        'New-PowerBIPerformanceAdvisor.ps1',
        'New-PowerBIReportUXCritic.ps1',
        'New-PowerBIExecutiveExplainabilityPack.ps1',
        'New-PowerBIModelGovernanceScorecard.ps1',
        'Test-PowerBICopilotReadiness.ps1',
        'New-PowerBIReleaseChecklist.ps1',
        'Invoke-PowerBIInnovationReview.ps1',
        'New-PowerBIBusinessSemanticLayer.ps1',
        'New-PowerBIKpiTrustScore.ps1',
        'New-PowerBIFlightRecorder.ps1',
        'New-PowerBIDecisionRiskAssistant.ps1',
        'Compare-PowerBIMeasureBehavior.ps1',
        'New-PowerBIReportNarrativeCritic.ps1',
        'Optimize-PowerBICopilotModel.ps1',
        'New-PowerBIDaxFixSimulation.ps1',
        'Invoke-PowerBIAutonomousFixAgent.ps1',
        'Compare-PowerBILiveRepoModel.ps1',
        'Test-PowerBIMeasureExpectations.ps1',
        'New-PowerBIPRReleaseComment.ps1',
        'New-PowerBIKpiTrustContract.ps1',
        'Invoke-PowerBIAskModel.ps1',
        'New-PowerBIFabricReadinessPlan.ps1',
        'Invoke-PowerBIFixUntilGreenLoop.ps1',
        'Test-PowerBISemanticModelCopilotEvaluator.ps1',
        'New-PowerBIDataContract.ps1',
        'New-PowerBIFabricDeploymentRiskSimulator.ps1',
        'New-PowerBIVisualIntentAnalyzer.ps1',
        'New-PowerBIBrokenMeasureRootCauseGraph.ps1',
        'New-PowerBIKpiTrustTwin.ps1',
        'Update-PowerBIReviewMemory.ps1',
        'New-PowerBINaturalLanguagePBIPAuthoring.ps1',
        'New-PowerBIGovernanceRuleMiner.ps1',
        'New-PowerBIExplainableDaxRefactoring.ps1',
        'New-PowerBIReportDecisionSimulator.ps1',
        'Invoke-PowerBIMaxAIReview.ps1',
        'New-PowerBIVisualMeasureImpactMap.ps1',
        'New-PowerBITrustReleaseGate.ps1',
        'New-PowerBIMeasureDraft.ps1',
        'New-PowerBICalculatedColumnDraft.ps1',
        'Test-PowerBIModelBestPractices.ps1',
        'New-PowerBIReportPageDraft.ps1',
        'New-PowerBIVisualDraft.ps1',
        'New-PowerBIReportLayoutPlan.ps1',
        'Add-PowerBIPBIPReportPage.ps1',
        'New-PowerBIPBIXCompileWorkflow.ps1',
        'Invoke-PowerBIUnifiedReview.ps1',
        'Test-PowerBIAnalysisMethodology.ps1',
        'New-PowerBIMetricChangeDiagnosis.ps1',
        'New-PowerBIAnalyticalReleaseReport.ps1',
        'New-PowerBIEvidenceGraph.ps1',
        'New-PowerBIDaxChangeRiskClassifier.ps1',
        'Test-PowerBISemanticContract.ps1',
        'Test-PowerBIDataFreshnessLineageGate.ps1',
        'New-PowerBIExecutiveTrustBrief.ps1',
        'New-PowerBIKpiDriftWatchlist.ps1',
        'New-PowerBIRlsTrustReview.ps1',
        'New-PowerBIReportUxRegressionScanner.ps1',
        'Test-PowerBIMigrationReadiness.ps1',
        'New-PowerBIPortfolioCommandCenter.ps1',
        'Test-PowerBIDeploymentPipelineGate.ps1',
        'Test-PowerBICertifiedDatasetReadiness.ps1',
        'New-PowerBICostToTrustOptimizer.ps1',
        'New-PowerBITenantHygieneScanner.ps1',
        'Resolve-PowerBIKpiDefinitionConflict.ps1',
        'Test-PowerBIReportAccessibilityCompliance.ps1',
        'Test-PowerBIPowerQueryDataContract.ps1',
        'New-PowerBIRefreshFailureRootCauseAdvisor.ps1',
        'New-PowerBISemanticTestCoverageScore.ps1',
        'New-PowerBIReleaseEvidenceSignature.ps1',
        'New-PowerBIBusinessKpiSlaMonitor.ps1',
        'Get-PowerBIFabricAccessPlan.ps1',
        'Invoke-PowerBIFabricReadOnlyRequest.ps1',
        'Import-PowerBIFabricWorkspaceSnapshot.ps1',
        'Import-PowerBIFabricTenantSnapshot.ps1',
        'PowerBIFabricSnapshot.Shared.ps1',
        'New-PowerBIFabricPortfolioCommandCenter.ps1',
        'New-PowerBIFabricTenantHygieneScanner.ps1',
        'New-PowerBIFabricCostToTrustOptimizer.ps1',
        'New-PowerBIFabricWorkspaceRiskRadar.ps1',
        'New-PowerBIFabricArtifactRetirementBoard.ps1',
        'Test-PowerBIFabricDeploymentPipelineGate.ps1',
        'Test-PowerBIFabricCertifiedDatasetReadiness.ps1',
        'New-PowerBIFabricReleaseEvidencePack.ps1',
        'New-PowerBIFabricPromotionRiskSimulator.ps1',
        'Compare-PowerBIFabricDevTestProdDrift.ps1',
        'New-PowerBIFabricRefreshFailureRootCauseAdvisor.ps1',
        'New-PowerBIFabricCapacityHotspotAnalyzer.ps1',
        'New-PowerBIFabricGatewayRiskReview.ps1',
        'New-PowerBIFabricRefreshSlaMonitor.ps1',
        'New-PowerBIFabricIncidentTimeline.ps1',
        'New-PowerBIFabricLineageEvidenceGraph.ps1',
        'Test-PowerBIFabricSensitivityLabelCoverage.ps1',
        'Test-PowerBIFabricSharingExposure.ps1',
        'Test-PowerBIFabricRlsServiceEvidence.ps1',
        'New-PowerBIFabricAuditEvidenceMap.ps1',
        'New-PowerBIFabricExecutiveWarRoom.ps1',
        'New-PowerBIFabricBoardBrief.ps1',
        'New-PowerBIFabricCfoRiskBrief.ps1',
        'New-PowerBIFabricDataProductScorecard.ps1',
        'New-PowerBIFabricTrustNarrative.ps1',
        'New-PowerBIExternalToolRegistration.ps1',
        'Install-PowerBIExternalTool.ps1',
        'Uninstall-PowerBIExternalTool.ps1',
        'Test-PowerBIGoldenBaselines.ps1'
    )
    $missingInnovationScripts = @($innovationScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'Innovation scripts are present' -Passed ($missingInnovationScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingInnovationScripts -join ', '))
}
catch {
    Add-TestResult -Name 'Innovation scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $guided = & (Join-Path $scriptsPath 'New-PowerBIGuidedFixPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Guided fix plan ranks fixes' -Passed ($guided.fixCount -ge 3 -and @($guided.fixes)[0].priority -eq 'P0') -Detail "FixCount=$($guided.fixCount)"
}
catch {
    Add-TestResult -Name 'Guided fix plan ranks fixes' -Passed $false -Detail $_.Exception.Message
}

try {
    $impact = & (Join-Path $scriptsPath 'New-PowerBIMeasureLineageImpact.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Measure lineage impact scores dependencies' -Passed ($impact.measureCount -eq 5 -and ($impact.measures | Where-Object { $_.downstreamCount -gt 0 }).Count -gt 0) -Detail "Measures=$($impact.measureCount)"
}
catch {
    Add-TestResult -Name 'Measure lineage impact scores dependencies' -Passed $false -Detail $_.Exception.Message
}

try {
    $testPlan = & (Join-Path $scriptsPath 'New-PowerBIMeasureTestPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Measure test generator creates DAX tests' -Passed ($testPlan.testCount -ge 15 -and @($testPlan.tests)[0].daxQuery) -Detail "Tests=$($testPlan.testCount)"
}
catch {
    Add-TestResult -Name 'Measure test generator creates DAX tests' -Passed $false -Detail $_.Exception.Message
}

try {
    $innovation = & (Join-Path $scriptsPath 'Invoke-PowerBIInnovationReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/innovation-review-test')
    $passed = (Test-Path -LiteralPath $innovation.Index) -and (Test-Path -LiteralPath (Join-Path $innovation.OutputDirectory 'governance-scorecard.md')) -and (Test-Path -LiteralPath (Join-Path $innovation.OutputDirectory 'release-checklist.md'))
    Add-TestResult -Name 'Innovation review creates package' -Passed $passed -Detail $innovation.OutputDirectory
}
catch {
    Add-TestResult -Name 'Innovation review creates package' -Passed $false -Detail $_.Exception.Message
}

try {
    $trust = & (Join-Path $scriptsPath 'New-PowerBIKpiTrustScore.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'KPI trust scores rate all metrics' -Passed ($trust.metricCount -eq 5 -and @($trust.metrics)[0].trustScore -ge 0 -and $trust.overallTrustScore -ge 0) -Detail "Metrics=$($trust.metricCount), Overall=$($trust.overallTrustScore)"
}
catch {
    Add-TestResult -Name 'KPI trust scores rate all metrics' -Passed $false -Detail $_.Exception.Message
}

try {
    $gate = & (Join-Path $scriptsPath 'New-PowerBITrustReleaseGate.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Trust release gate returns decision' -Passed (@('Go', 'Warn', 'No-Go') -contains $gate.decision -and $gate.checkCount -ge 5) -Detail "Decision=$($gate.decision)"
}
catch {
    Add-TestResult -Name 'Trust release gate returns decision' -Passed $false -Detail $_.Exception.Message
}

try {
    $semantic = & (Join-Path $scriptsPath 'New-PowerBIBusinessSemanticLayer.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Business semantic layer explains decisions' -Passed ($semantic.metricCount -eq 5 -and @($semantic.metrics)[0].decisionContext) -Detail "Metrics=$($semantic.metricCount)"
}
catch {
    Add-TestResult -Name 'Business semantic layer explains decisions' -Passed $false -Detail $_.Exception.Message
}

try {
    $fixAgent = & (Join-Path $scriptsPath 'Invoke-PowerBIAutonomousFixAgent.ps1') -Path $samplePath -MaxFixes 2 -Json | ConvertFrom-Json
    Add-TestResult -Name 'Autonomous fix agent creates fix loop plan' -Passed ($fixAgent.fixCount -ge 1 -and @($fixAgent.fixes)[0].proposedDax) -Detail "Fixes=$($fixAgent.fixCount)"
}
catch {
    Add-TestResult -Name 'Autonomous fix agent creates fix loop plan' -Passed $false -Detail $_.Exception.Message
}

try {
    $reconcile = & (Join-Path $scriptsPath 'Compare-PowerBILiveRepoModel.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Live repo reconciliation handles unavailable live endpoint' -Passed (@('LiveUnavailable','NoDrift','DriftDetected') -contains $reconcile.liveStatus) -Detail "LiveStatus=$($reconcile.liveStatus)"
}
catch {
    Add-TestResult -Name 'Live repo reconciliation handles unavailable live endpoint' -Passed $false -Detail $_.Exception.Message
}

try {
    $expectationPath = Join-Path $PluginRoot 'tmp/measure-expectations-test.json'
    if (Test-Path -LiteralPath $expectationPath) { Remove-Item -LiteralPath $expectationPath -Force }
    $expectations = & (Join-Path $scriptsPath 'Test-PowerBIMeasureExpectations.ps1') -Path $samplePath -ExpectationsPath $expectationPath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Measure expectation harness creates template' -Passed ($expectations.status -eq 'TemplateCreated' -and (Test-Path -LiteralPath $expectationPath)) -Detail $expectationPath
}
catch {
    Add-TestResult -Name 'Measure expectation harness creates template' -Passed $false -Detail $_.Exception.Message
}

try {
    $comment = & (Join-Path $scriptsPath 'New-PowerBIPRReleaseComment.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'PR release comment creates CI decision' -Passed ($comment.comment -match 'Power BI Release Gate' -and $comment.exitCode -ge 0) -Detail "Decision=$($comment.decision), Exit=$($comment.exitCode)"
}
catch {
    Add-TestResult -Name 'PR release comment creates CI decision' -Passed $false -Detail $_.Exception.Message
}

try {
    $contract = & (Join-Path $scriptsPath 'New-PowerBIKpiTrustContract.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'KPI trust contract creates semantic QA records' -Passed ($contract.metricCount -eq 5 -and @($contract.contracts)[0].acceptanceTest) -Detail "Contracts=$($contract.metricCount)"
}
catch {
    Add-TestResult -Name 'KPI trust contract creates semantic QA records' -Passed $false -Detail $_.Exception.Message
}

try {
    $ask = & (Join-Path $scriptsPath 'Invoke-PowerBIAskModel.ps1') -Path $samplePath -Question 'Which sales measures drive release risk?' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Ask model ranks relevant measures' -Passed ($ask.matchCount -ge 1 -and $ask.answer) -Detail "Matches=$($ask.matchCount)"
}
catch {
    Add-TestResult -Name 'Ask model ranks relevant measures' -Passed $false -Detail $_.Exception.Message
}

try {
    $fabric = & (Join-Path $scriptsPath 'New-PowerBIFabricReadinessPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Fabric readiness plan creates deployment steps' -Passed ($fabric.stepCount -ge 5 -and $fabric.releaseDecision) -Detail "Decision=$($fabric.releaseDecision)"
}
catch {
    Add-TestResult -Name 'Fabric readiness plan creates deployment steps' -Passed $false -Detail $_.Exception.Message
}

try {
    $newUspScripts = @(
        'New-PowerBIAgenticRemediationPlan.ps1',
        'New-PowerBIBusinessOutcomeSimulator.ps1',
        'New-PowerBISemanticLayerAutopilot.ps1',
        'New-PowerBIAIGovernanceEvidencePack.ps1',
        'New-PowerBIHumanOverrideLearning.ps1',
        'New-PowerBICrossReportKpiConflictDetector.ps1',
        'New-PowerBIExecutiveNarrativeQualityAgent.ps1',
        'New-PowerBIAutonomousQALab.ps1',
        'New-PowerBIPBIPChangeImpactGate.ps1',
        'New-PowerBISemanticTestFixtureGenerator.ps1',
        'New-PowerBIKpiOwnerSignoffWorkflow.ps1',
        'New-PowerBIRefreshBlastRadiusAnalyzer.ps1',
        'New-PowerBISensitiveDataExposureMap.ps1',
        'New-PowerBICapacityMitigationPlanner.ps1',
        'New-PowerBIReportRetirementAdvisor.ps1',
        'New-PowerBILiveValidationEvidenceRecorder.ps1',
        'New-PowerBISemanticContractDriftMonitor.ps1',
        'New-PowerBIRlsPersonaCoverageMatrix.ps1'
    )
    $missingNewUspScripts = @($newUspScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name '38-USP AI/KI expansion scripts are present' -Passed ($missingNewUspScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingNewUspScripts -join ', '))
}
catch {
    Add-TestResult -Name '38-USP AI/KI expansion scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $agentic = & (Join-Path $scriptsPath 'New-PowerBIAgenticRemediationPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $outcome = & (Join-Path $scriptsPath 'New-PowerBIBusinessOutcomeSimulator.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $semantic = & (Join-Path $scriptsPath 'New-PowerBISemanticLayerAutopilot.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $governance = & (Join-Path $scriptsPath 'New-PowerBIAIGovernanceEvidencePack.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/ai-governance-evidence-test') -Json | ConvertFrom-Json
    $override = & (Join-Path $scriptsPath 'New-PowerBIHumanOverrideLearning.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $conflicts = & (Join-Path $scriptsPath 'New-PowerBICrossReportKpiConflictDetector.ps1') -Path $samplePath -ComparisonPath $samplePath -Json | ConvertFrom-Json
    $narrative = & (Join-Path $scriptsPath 'New-PowerBIExecutiveNarrativeQualityAgent.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $qa = & (Join-Path $scriptsPath 'New-PowerBIAutonomousQALab.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/autonomous-qa-lab-test') -Json | ConvertFrom-Json
    $changeGate = & (Join-Path $scriptsPath 'New-PowerBIPBIPChangeImpactGate.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $fixtures = & (Join-Path $scriptsPath 'New-PowerBISemanticTestFixtureGenerator.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/semantic-fixtures-test') -Json | ConvertFrom-Json
    $signoff = & (Join-Path $scriptsPath 'New-PowerBIKpiOwnerSignoffWorkflow.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $refreshBlast = & (Join-Path $scriptsPath 'New-PowerBIRefreshBlastRadiusAnalyzer.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $sensitive = & (Join-Path $scriptsPath 'New-PowerBISensitiveDataExposureMap.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $capacityPlan = & (Join-Path $scriptsPath 'New-PowerBICapacityMitigationPlanner.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $retirement = & (Join-Path $scriptsPath 'New-PowerBIReportRetirementAdvisor.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $liveEvidence = & (Join-Path $scriptsPath 'New-PowerBILiveValidationEvidenceRecorder.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/live-validation-evidence-test') -Json | ConvertFrom-Json
    $contractDrift = & (Join-Path $scriptsPath 'New-PowerBISemanticContractDriftMonitor.ps1') -Path $samplePath -Json | ConvertFrom-Json
    $personaCoverage = & (Join-Path $scriptsPath 'New-PowerBIRlsPersonaCoverageMatrix.ps1') -Path $samplePath -Json | ConvertFrom-Json

    $passed = (
        $agentic.schema -eq 'codex.powerbi.agenticRemediationPlan.v1' -and
        $outcome.schema -eq 'codex.powerbi.businessOutcomeSimulator.v1' -and
        $semantic.schema -eq 'codex.powerbi.semanticLayerAutopilot.v1' -and
        $governance.schema -eq 'codex.powerbi.aiGovernanceEvidencePack.v1' -and
        $override.schema -eq 'codex.powerbi.humanOverrideLearning.v1' -and
        $conflicts.schema -eq 'codex.powerbi.crossReportKpiConflicts.v1' -and
        $narrative.schema -eq 'codex.powerbi.executiveNarrativeQuality.v1' -and
        $qa.schema -eq 'codex.powerbi.autonomousQALab.v1' -and
        $changeGate.schema -eq 'codex.powerbi.pbipChangeImpactGate.v1' -and
        $fixtures.schema -eq 'codex.powerbi.semanticTestFixtureGenerator.v1' -and
        $signoff.schema -eq 'codex.powerbi.kpiOwnerSignoffWorkflow.v1' -and
        $refreshBlast.schema -eq 'codex.powerbi.refreshBlastRadius.v1' -and
        $sensitive.schema -eq 'codex.powerbi.sensitiveDataExposureMap.v1' -and
        $capacityPlan.schema -eq 'codex.powerbi.capacityMitigationPlanner.v1' -and
        $retirement.schema -eq 'codex.powerbi.reportRetirementAdvisor.v1' -and
        $liveEvidence.schema -eq 'codex.powerbi.liveValidationEvidenceRecorder.v1' -and
        $contractDrift.schema -eq 'codex.powerbi.semanticContractDriftMonitor.v1' -and
        $personaCoverage.schema -eq 'codex.powerbi.rlsPersonaCoverageMatrix.v1' -and
        $agentic.itemCount -ge 1 -and
        $semantic.metricCount -eq 5 -and
        $override.status -eq 'NeedsOverrideInput' -and
        $qa.qaQuestionCount -eq 5 -and
        $fixtures.expectationCount -gt 0 -and
        $signoff.signoffItemCount -gt 0 -and
        $capacityPlan.mitigationCount -gt 0
    )
    Add-TestResult -Name '38-USP AI/KI expansion scripts return expected schemas' -Passed $passed -Detail "Agentic=$($agentic.itemCount), QA=$($qa.qaQuestionCount), Signoff=$($signoff.signoffItemCount)"
}
catch {
    Add-TestResult -Name '38-USP AI/KI expansion scripts return expected schemas' -Passed $false -Detail $_.Exception.Message
}

try {
    $maxAi = & (Join-Path $scriptsPath 'Invoke-PowerBIMaxAIReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/max-ai-review-test')
    $passed = ($maxAi.ArtifactCount -eq 39) -and (Test-Path -LiteralPath $maxAi.Index) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'kpi-trust-twin.json')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'report-decision-simulator.md')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'agentic-remediation-plan.json')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'ai-governance-evidence-pack/summary.json')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'autonomous-qa-lab/summary.json')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'pbip-change-impact-gate.json')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'semantic-test-fixtures/measure-expectations.json')) -and (Test-Path -LiteralPath (Join-Path $maxAi.OutputDirectory 'rls-persona-coverage.json'))
    Add-TestResult -Name 'Max AI review creates 39-artifact USP package' -Passed $passed -Detail $maxAi.OutputDirectory
}
catch {
    Add-TestResult -Name 'Max AI review creates 39-artifact USP package' -Passed $false -Detail $_.Exception.Message
}

try {
    $uspReview = & (Join-Path $scriptsPath 'Invoke-PowerBIInnovationReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/usp-review-test')
    $passed = (Test-Path -LiteralPath (Join-Path $uspReview.OutputDirectory 'trust-release-gate.md')) -and (Test-Path -LiteralPath (Join-Path $uspReview.OutputDirectory 'kpi-trust-score.md')) -and (Test-Path -LiteralPath (Join-Path $uspReview.OutputDirectory 'decision-risk-assistant.md')) -and (Test-Path -LiteralPath (Join-Path $uspReview.OutputDirectory 'fabric-readiness-plan.md')) -and (Test-Path -LiteralPath (Join-Path $uspReview.OutputDirectory 'kpi-trust-contract.md')) -and (Test-Path -LiteralPath (Join-Path $uspReview.OutputDirectory 'max-ai-review/README.md'))
    Add-TestResult -Name 'Innovation review includes USP package' -Passed $passed -Detail $uspReview.OutputDirectory
}
catch {
    Add-TestResult -Name 'Innovation review includes USP package' -Passed $false -Detail $_.Exception.Message
}

try {
    $rulesPath = Join-Path $PluginRoot 'rules/powerbi-trust-rules.json'
    $rules = Get-Content -Raw -LiteralPath $rulesPath | ConvertFrom-Json
    Add-TestResult -Name 'Trust rules config exists' -Passed ($rules.schema -eq 'codex.powerbi.trustRules.v1' -and $rules.releaseGate.goThreshold -gt 0) -Detail $rulesPath
}
catch {
    Add-TestResult -Name 'Trust rules config exists' -Passed $false -Detail $_.Exception.Message
}

try {
    $measureDraft = & (Join-Path $scriptsPath 'New-PowerBIMeasureDraft.ps1') -TableName 'Sales' -MeasureName 'Average Sales' -Expression "DIVIDE([Total Sales], COUNTROWS('Sales'))" -OutputPath (Join-Path $PluginRoot 'tmp/measure-draft-test.md') -Json | ConvertFrom-Json
    Add-TestResult -Name 'Measure draft generator creates safe draft' -Passed ($measureDraft.objectType -eq 'Measure' -and $measureDraft.tmdl -match 'measure Average Sales') -Detail $measureDraft.outputPath
}
catch {
    Add-TestResult -Name 'Measure draft generator creates safe draft' -Passed $false -Detail $_.Exception.Message
}

try {
    $columnDraft = & (Join-Path $scriptsPath 'New-PowerBICalculatedColumnDraft.ps1') -TableName 'Sales' -ColumnName 'Sales Bucket' -Expression "IF('Sales'[Sales Amount] > 1000, ""High"", ""Standard"")" -OutputPath (Join-Path $PluginRoot 'tmp/column-draft-test.md') -Json | ConvertFrom-Json
    Add-TestResult -Name 'Calculated column draft generator creates safe draft' -Passed ($columnDraft.objectType -eq 'CalculatedColumn' -and $columnDraft.tmdl -match 'column Sales Bucket') -Detail $columnDraft.outputPath
}
catch {
    Add-TestResult -Name 'Calculated column draft generator creates safe draft' -Passed $false -Detail $_.Exception.Message
}

try {
    $bestPractices = & (Join-Path $scriptsPath 'Test-PowerBIModelBestPractices.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Model best practices produce findings' -Passed ($bestPractices.findingCount -ge 1 -and $bestPractices.score -ge 0) -Detail "Findings=$($bestPractices.findingCount), Score=$($bestPractices.score)"
}
catch {
    Add-TestResult -Name 'Model best practices produce findings' -Passed $false -Detail $_.Exception.Message
}

try {
    $pesterPath = Join-Path $PluginRoot 'tests/pester/PowerBIPlugin.Tests.ps1'
    Add-TestResult -Name 'Pester test file exists in subdirectory' -Passed (Test-Path -LiteralPath $pesterPath) -Detail $pesterPath
}
catch {
    Add-TestResult -Name 'Pester test file exists in subdirectory' -Passed $false -Detail $_.Exception.Message
}

try {
    $pageDraft = & (Join-Path $scriptsPath 'New-PowerBIReportPageDraft.ps1') -PageName 'Executive Overview' -Measures 'Total Sales','Sales YoY %' -OutputPath (Join-Path $PluginRoot 'tmp/page-draft-test.json') -Json | ConvertFrom-Json
    Add-TestResult -Name 'Report page draft creates visual specs' -Passed ($pageDraft.pageName -eq 'Executive Overview' -and @($pageDraft.visuals).Count -ge 2) -Detail "Visuals=$(@($pageDraft.visuals).Count)"
}
catch {
    Add-TestResult -Name 'Report page draft creates visual specs' -Passed $false -Detail $_.Exception.Message
}

try {
    $visualDraft = & (Join-Path $scriptsPath 'New-PowerBIVisualDraft.ps1') -VisualType 'KpiCard' -Title 'Total Sales' -Measure 'Total Sales' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Visual draft creates PBIP-safe spec' -Passed ($visualDraft.visualType -eq 'KpiCard' -and $visualDraft.measure -eq 'Total Sales') -Detail $visualDraft.visualId
}
catch {
    Add-TestResult -Name 'Visual draft creates PBIP-safe spec' -Passed $false -Detail $_.Exception.Message
}

try {
    $layout = & (Join-Path $scriptsPath 'New-PowerBIReportLayoutPlan.ps1') -PageName 'Executive Overview' -VisualCount 4 -Json | ConvertFrom-Json
    Add-TestResult -Name 'Report layout plan creates stable slots' -Passed ($layout.slotCount -eq 4 -and @($layout.slots)[0].width -gt 0) -Detail "Slots=$($layout.slotCount)"
}
catch {
    Add-TestResult -Name 'Report layout plan creates stable slots' -Passed $false -Detail $_.Exception.Message
}

try {
    $applyRoot = Join-Path $PluginRoot 'tmp/pbip-page-apply-test'
    $apply = & (Join-Path $scriptsPath 'Add-PowerBIPBIPReportPage.ps1') -PbipPath $applyRoot -PageName 'Executive Overview' -Measures 'Total Sales','Sales YoY %' -Apply -Json | ConvertFrom-Json
    Add-TestResult -Name 'PBIP report page apply writes draft files' -Passed ($apply.applied -eq $true -and (Test-Path -LiteralPath $apply.pagePath)) -Detail $apply.pagePath
}
catch {
    Add-TestResult -Name 'PBIP report page apply writes draft files' -Passed $false -Detail $_.Exception.Message
}

try {
    $externalRegistration = & (Join-Path $scriptsPath 'New-PowerBIExternalToolRegistration.ps1') -OutputPath (Join-Path $PluginRoot 'tmp/external-tool/Codex Power BI Workbench.pbitool.json') -Json | ConvertFrom-Json
    Add-TestResult -Name 'External Tool registration creates pbitool file' -Passed ((Test-Path -LiteralPath $externalRegistration.outputPath) -and $externalRegistration.tool.name -eq 'Codex Power BI Workbench') -Detail $externalRegistration.outputPath
}
catch {
    Add-TestResult -Name 'External Tool registration creates pbitool file' -Passed $false -Detail $_.Exception.Message
}

try {
    Add-TestResult -Name 'External Tool install scripts are present' -Passed ((Test-Path -LiteralPath (Join-Path $scriptsPath 'Install-PowerBIExternalTool.ps1')) -and (Test-Path -LiteralPath (Join-Path $scriptsPath 'Uninstall-PowerBIExternalTool.ps1'))) -Detail $scriptsPath
}
catch {
    Add-TestResult -Name 'External Tool install scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $golden = & (Join-Path $scriptsPath 'Test-PowerBIGoldenBaselines.ps1') -PluginRoot $PluginRoot -Json | ConvertFrom-Json
    Add-TestResult -Name 'Golden baselines pass sample models' -Passed ($golden.failedCount -eq 0 -and $golden.checkCount -ge 20) -Detail "Baselines=$($golden.baselineCount), Checks=$($golden.checkCount)"
}
catch {
    Add-TestResult -Name 'Golden baselines pass sample models' -Passed $false -Detail $_.Exception.Message
}

try {
    $unified = & (Join-Path $scriptsPath 'Invoke-PowerBIUnifiedReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/unified-review-test') -SkipLive
    $passed = (Test-Path -LiteralPath $unified.Index) -and (Test-Path -LiteralPath $unified.Summary) -and (Test-Path -LiteralPath (Join-Path $unified.OutputDirectory 'external-tool/Codex Power BI Workbench.pbitool.json'))
    Add-TestResult -Name 'Unified review creates combined index' -Passed $passed -Detail $unified.OutputDirectory
}
catch {
    Add-TestResult -Name 'Unified review creates combined index' -Passed $false -Detail $_.Exception.Message
}

try {
    $compile = & (Join-Path $scriptsPath 'New-PowerBIPBIXCompileWorkflow.ps1') -PbipPath (Join-Path $PluginRoot 'tmp/pbip-page-apply-test') -OutputPbix (Join-Path $PluginRoot 'tmp/report.pbix') -Json | ConvertFrom-Json
    Add-TestResult -Name 'PBIX compile workflow creates commands' -Passed ($compile.workflow -eq 'PBIP to PBIX' -and @($compile.steps).Count -ge 3) -Detail $compile.recommendedPath
}
catch {
    Add-TestResult -Name 'PBIX compile workflow creates commands' -Passed $false -Detail $_.Exception.Message
}

try {
    $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PluginRoot '../..')).Path
    $docsPath = Join-Path $repoRoot 'docs'
    $requiredDocs = @(
        'index.md',
        'getting-started.md',
        'architecture.md',
        'script-catalog.md',
        'workflows.md',
        'unified-review.md',
        'max-ai-review.md',
        'ai-usp-workflows.md',
        'enterprise-ai-features.md',
        'live-desktop.md',
        'pbip-apply-engine.md',
        'fabric.md',
        'governance.md',
        'external-tool-installation.md',
        'golden-baselines.md',
        'testing.md',
        'privacy.md',
        'release-checklist.md',
        'example-output.md',
        'troubleshooting.md',
        'value-proposition.md'
    )
    $missingDocs = @($requiredDocs | Where-Object { -not (Test-Path -LiteralPath (Join-Path $docsPath $_)) })
    Add-TestResult -Name 'Documentation coverage files are present' -Passed ($missingDocs.Count -eq 0) -Detail ("Missing={0}" -f ($missingDocs -join ', '))
}
catch {
    Add-TestResult -Name 'Documentation coverage files are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $enterpriseScripts = @(
        'Get-PowerBIFabricWorkspaceInventory.ps1',
        'New-PowerBIServiceScanner.ps1',
        'New-PowerBITomWritePlan.ps1',
        'Optimize-PowerBIReportLayout.ps1',
        'Invoke-PowerBISemanticTestRunner.ps1',
        'Import-PowerBIPerformanceTrace.ps1',
        'Import-PowerBIVertiPaqAnalyzer.ps1',
        'New-PowerBIReportScreenshotUXReview.ps1',
        'New-PowerBIGovernancePolicyPack.ps1',
        'Update-PowerBIChangeJournal.ps1',
        'New-PowerBIModelRiskHeatmap.ps1',
        'New-PowerBIReleaseCandidatePack.ps1',
        'Test-PowerBIAnalysisMethodology.ps1',
        'New-PowerBIMetricChangeDiagnosis.ps1',
        'New-PowerBIAnalyticalReleaseReport.ps1',
        'New-PowerBIEvidenceGraph.ps1',
        'New-PowerBIDaxChangeRiskClassifier.ps1',
        'Test-PowerBISemanticContract.ps1',
        'Test-PowerBIDataFreshnessLineageGate.ps1',
        'New-PowerBIExecutiveTrustBrief.ps1',
        'New-PowerBIKpiDriftWatchlist.ps1',
        'New-PowerBIRlsTrustReview.ps1',
        'New-PowerBIReportUxRegressionScanner.ps1',
        'Test-PowerBIMigrationReadiness.ps1',
        'New-PowerBIPortfolioCommandCenter.ps1',
        'Test-PowerBIDeploymentPipelineGate.ps1',
        'Test-PowerBICertifiedDatasetReadiness.ps1',
        'New-PowerBICostToTrustOptimizer.ps1',
        'New-PowerBITenantHygieneScanner.ps1',
        'Resolve-PowerBIKpiDefinitionConflict.ps1',
        'Test-PowerBIReportAccessibilityCompliance.ps1',
        'Test-PowerBIPowerQueryDataContract.ps1',
        'New-PowerBIRefreshFailureRootCauseAdvisor.ps1',
        'New-PowerBISemanticTestCoverageScore.ps1',
        'New-PowerBIReleaseEvidenceSignature.ps1',
        'New-PowerBIBusinessKpiSlaMonitor.ps1',
        'Get-PowerBIFabricAccessPlan.ps1',
        'Invoke-PowerBIFabricReadOnlyRequest.ps1',
        'Import-PowerBIFabricWorkspaceSnapshot.ps1',
        'Import-PowerBIFabricTenantSnapshot.ps1',
        'PowerBIFabricSnapshot.Shared.ps1',
        'New-PowerBIFabricPortfolioCommandCenter.ps1',
        'New-PowerBIFabricTenantHygieneScanner.ps1',
        'New-PowerBIFabricCostToTrustOptimizer.ps1',
        'New-PowerBIFabricWorkspaceRiskRadar.ps1',
        'New-PowerBIFabricArtifactRetirementBoard.ps1',
        'Test-PowerBIFabricDeploymentPipelineGate.ps1',
        'Test-PowerBIFabricCertifiedDatasetReadiness.ps1',
        'New-PowerBIFabricReleaseEvidencePack.ps1',
        'New-PowerBIFabricPromotionRiskSimulator.ps1',
        'Compare-PowerBIFabricDevTestProdDrift.ps1',
        'New-PowerBIFabricRefreshFailureRootCauseAdvisor.ps1',
        'New-PowerBIFabricCapacityHotspotAnalyzer.ps1',
        'New-PowerBIFabricGatewayRiskReview.ps1',
        'New-PowerBIFabricRefreshSlaMonitor.ps1',
        'New-PowerBIFabricIncidentTimeline.ps1',
        'New-PowerBIFabricLineageEvidenceGraph.ps1',
        'Test-PowerBIFabricSensitivityLabelCoverage.ps1',
        'Test-PowerBIFabricSharingExposure.ps1',
        'Test-PowerBIFabricRlsServiceEvidence.ps1',
        'New-PowerBIFabricAuditEvidenceMap.ps1',
        'New-PowerBIFabricExecutiveWarRoom.ps1',
        'New-PowerBIFabricBoardBrief.ps1',
        'New-PowerBIFabricCfoRiskBrief.ps1',
        'New-PowerBIFabricDataProductScorecard.ps1',
        'New-PowerBIFabricTrustNarrative.ps1',
        'New-PowerBIAgenticRemediationPlan.ps1',
        'New-PowerBIBusinessOutcomeSimulator.ps1',
        'New-PowerBISemanticLayerAutopilot.ps1',
        'New-PowerBIAIGovernanceEvidencePack.ps1',
        'New-PowerBIHumanOverrideLearning.ps1',
        'New-PowerBICrossReportKpiConflictDetector.ps1',
        'New-PowerBIExecutiveNarrativeQualityAgent.ps1',
        'New-PowerBIAutonomousQALab.ps1'
    )
    $missingEnterpriseScripts = @($enterpriseScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    Add-TestResult -Name 'Enterprise AI feature scripts are present' -Passed ($missingEnterpriseScripts.Count -eq 0) -Detail ("Missing={0}" -f ($missingEnterpriseScripts -join ', '))
}
catch {
    Add-TestResult -Name 'Enterprise AI feature scripts are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $fabricInventory = & (Join-Path $scriptsPath 'Get-PowerBIFabricWorkspaceInventory.ps1') -WorkspaceName 'Demo Workspace' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Fabric workspace inventory supports offline mode' -Passed ($fabricInventory.schema -eq 'codex.powerbi.fabricWorkspaceInventory.v1' -and $fabricInventory.mode -eq 'OfflinePlan') -Detail $fabricInventory.workspaceName
}
catch {
    Add-TestResult -Name 'Fabric workspace inventory supports offline mode' -Passed $false -Detail $_.Exception.Message
}

try {
    $serviceScan = & (Join-Path $scriptsPath 'New-PowerBIServiceScanner.ps1') -Path $samplePath -WorkspaceName 'Demo Workspace' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Service scanner creates governance findings' -Passed ($serviceScan.schema -eq 'codex.powerbi.serviceScanner.v1' -and $serviceScan.findingCount -ge 3) -Detail "Findings=$($serviceScan.findingCount)"
}
catch {
    Add-TestResult -Name 'Service scanner creates governance findings' -Passed $false -Detail $_.Exception.Message
}

try {
    $tomPlan = & (Join-Path $scriptsPath 'New-PowerBITomWritePlan.ps1') -Operation AddMeasure -TableName Sales -ObjectName 'Average Sales' -Expression "DIVIDE([Total Sales], COUNTROWS('Sales'))" -Json | ConvertFrom-Json
    Add-TestResult -Name 'TOM write plan is gated and reversible' -Passed ($tomPlan.schema -eq 'codex.powerbi.tomWritePlan.v1' -and $tomPlan.dryRun -eq $true -and @($tomPlan.safetyGates).Count -ge 4) -Detail $tomPlan.operation
}
catch {
    Add-TestResult -Name 'TOM write plan is gated and reversible' -Passed $false -Detail $_.Exception.Message
}

try {
    $layoutFix = & (Join-Path $scriptsPath 'Optimize-PowerBIReportLayout.ps1') -PageName 'Executive Overview' -VisualCount 5 -Json | ConvertFrom-Json
    Add-TestResult -Name 'Visual layout optimizer creates fixes' -Passed ($layoutFix.schema -eq 'codex.powerbi.reportLayoutOptimizer.v1' -and $layoutFix.fixCount -ge 5) -Detail "Fixes=$($layoutFix.fixCount)"
}
catch {
    Add-TestResult -Name 'Visual layout optimizer creates fixes' -Passed $false -Detail $_.Exception.Message
}

try {
    $semanticTests = & (Join-Path $scriptsPath 'Invoke-PowerBISemanticTestRunner.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Semantic test runner evaluates measures' -Passed ($semanticTests.schema -eq 'codex.powerbi.semanticTestRunner.v2' -and $semanticTests.testCount -ge 5) -Detail "Tests=$($semanticTests.testCount), Failed=$($semanticTests.failedCount)"
}
catch {
    Add-TestResult -Name 'Semantic test runner evaluates measures' -Passed $false -Detail $_.Exception.Message
}

try {
    $perfTrace = & (Join-Path $scriptsPath 'Import-PowerBIPerformanceTrace.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Performance trace importer produces hotspot model' -Passed ($perfTrace.schema -eq 'codex.powerbi.performanceTraceImport.v1' -and $perfTrace.hotspotCount -ge 1) -Detail "Hotspots=$($perfTrace.hotspotCount)"
}
catch {
    Add-TestResult -Name 'Performance trace importer produces hotspot model' -Passed $false -Detail $_.Exception.Message
}

try {
    $vertipaq = & (Join-Path $scriptsPath 'Import-PowerBIVertiPaqAnalyzer.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'VertiPaq importer estimates storage risk' -Passed ($vertipaq.schema -eq 'codex.powerbi.vertipaqImport.v1' -and $vertipaq.columnCount -ge 1) -Detail "Columns=$($vertipaq.columnCount)"
}
catch {
    Add-TestResult -Name 'VertiPaq importer estimates storage risk' -Passed $false -Detail $_.Exception.Message
}

try {
    $uxReview = & (Join-Path $scriptsPath 'New-PowerBIReportScreenshotUXReview.ps1') -ImagePath '.\missing-screenshot.png' -Json | ConvertFrom-Json
    Add-TestResult -Name 'Screenshot UX review handles missing screenshots' -Passed ($uxReview.schema -eq 'codex.powerbi.screenshotUxReview.v1' -and $uxReview.status -eq 'NotAvailable' -and $uxReview.needsInput) -Detail $uxReview.status
}
catch {
    Add-TestResult -Name 'Screenshot UX review handles missing screenshots' -Passed $false -Detail $_.Exception.Message
}

try {
    $policyPack = & (Join-Path $scriptsPath 'New-PowerBIGovernancePolicyPack.ps1') -Profile EnterpriseBI -Json | ConvertFrom-Json
    Add-TestResult -Name 'Governance policy pack creates profile rules' -Passed ($policyPack.schema -eq 'codex.powerbi.governancePolicyPack.v1' -and $policyPack.ruleCount -ge 6) -Detail "Rules=$($policyPack.ruleCount)"
}
catch {
    Add-TestResult -Name 'Governance policy pack creates profile rules' -Passed $false -Detail $_.Exception.Message
}

try {
    $journalPath = Join-Path $PluginRoot 'tmp/change-journal-test.json'
    if (Test-Path -LiteralPath $journalPath) { Remove-Item -LiteralPath $journalPath -Force }
    $journal = & (Join-Path $scriptsPath 'Update-PowerBIChangeJournal.ps1') -JournalPath $journalPath -Title 'Refactor Total Sales' -Status proposed -Json | ConvertFrom-Json
    Add-TestResult -Name 'AI change journal records decisions' -Passed ($journal.schema -eq 'codex.powerbi.changeJournal.v1' -and $journal.entryCount -eq 1 -and (Test-Path -LiteralPath $journalPath)) -Detail "Entries=$($journal.entryCount)"
}
catch {
    Add-TestResult -Name 'AI change journal records decisions' -Passed $false -Detail $_.Exception.Message
}

try {
    $heatmap = & (Join-Path $scriptsPath 'New-PowerBIModelRiskHeatmap.ps1') -Path $samplePath -Json | ConvertFrom-Json
    Add-TestResult -Name 'Model risk heatmap aggregates risk areas' -Passed ($heatmap.schema -eq 'codex.powerbi.modelRiskHeatmap.v1' -and @($heatmap.areas).Count -ge 5) -Detail "Overall=$($heatmap.overallRisk)"
}
catch {
    Add-TestResult -Name 'Model risk heatmap aggregates risk areas' -Passed $false -Detail $_.Exception.Message
}

try {
    $candidate = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/release-candidate-pack-test')
    $passed = (Test-Path -LiteralPath $candidate.Index) -and (Test-Path -LiteralPath (Join-Path $candidate.OutputDirectory 'model-risk-heatmap.json')) -and (Test-Path -LiteralPath (Join-Path $candidate.OutputDirectory 'service-scanner.json'))
    Add-TestResult -Name 'Release candidate pack creates enterprise index' -Passed $passed -Detail $candidate.OutputDirectory
}
catch {
    Add-TestResult -Name 'Release candidate pack creates enterprise index' -Passed $false -Detail $_.Exception.Message
}

try {
    $processScripts = @(
        'New-PowerBIProcessDataMapping.ps1',
        'Invoke-PowerBIBusinessProcessDataQuality.ps1',
        'New-PowerBIBusinessProcessDQPack.ps1'
    )
    $missingProcessScripts = @($processScripts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scriptsPath $_)) })
    $packsPath = Join-Path $PluginRoot 'rules/process-packs'
    $packs = @(Get-ChildItem -LiteralPath $packsPath -File -Filter '*.json' | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json })
    $packSchemasOk = (@($packs | Where-Object { $_.schema -ne 'codex.powerbi.processRulePack.v1' }).Count -eq 0)
    Add-TestResult -Name 'Business process DQ scripts and rule packs are present' -Passed ($missingProcessScripts.Count -eq 0 -and $packs.Count -ge 10 -and $packSchemasOk) -Detail ("Missing={0}, Packs={1}" -f ($missingProcessScripts -join ', '), $packs.Count)
}
catch {
    Add-TestResult -Name 'Business process DQ scripts and rule packs are present' -Passed $false -Detail $_.Exception.Message
}

try {
    $mapping = & (Join-Path $scriptsPath 'New-PowerBIProcessDataMapping.ps1') -Path $samplePath -DataPath $businessProcessDataPath -Json | ConvertFrom-Json
    $dq = & (Join-Path $scriptsPath 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $samplePath -DataPath $businessProcessDataPath -OutputDirectory (Join-Path $PluginRoot 'tmp/business-process-dq-test') -ProcessPack All -Json | ConvertFrom-Json
    $passed = (
        $mapping.schema -eq 'codex.powerbi.processDataMapping.v1' -and
        $mapping.status -eq 'NeedsMapping' -and
        $dq.schema -eq 'codex.powerbi.businessProcessDataQuality.v1' -and
        $dq.status -eq 'NeedsMapping' -and
        $dq.findingCount -gt 0 -and
        $dq.highCount -gt 0 -and
        $dq.mediumCount -gt 0
    )
    Add-TestResult -Name 'Business process DQ runs against sample exports' -Passed $passed -Detail "Status=$($dq.status), Findings=$($dq.findingCount), High=$($dq.highCount)"
}
catch {
    Add-TestResult -Name 'Business process DQ runs against sample exports' -Passed $false -Detail $_.Exception.Message
}

try {
    $candidateWithProcess = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory (Join-Path $PluginRoot 'tmp/release-candidate-process-dq-test') -IncludeBusinessProcessDQ -BusinessProcessDataPath $businessProcessDataPath
    $summary = Get-Content -Raw -LiteralPath $candidateWithProcess.Summary | ConvertFrom-Json
    Add-TestResult -Name 'Release candidate pack includes optional business process DQ' -Passed ($summary.enterpriseUsps.businessProcessDqStatus -and $summary.enterpriseUsps.businessProcessDqStatus -ne 'NotRun' -and $summary.enterpriseUsps.businessProcessDqHighCount -gt 0) -Detail "Status=$($summary.enterpriseUsps.businessProcessDqStatus), High=$($summary.enterpriseUsps.businessProcessDqHighCount)"
}
catch {
    Add-TestResult -Name 'Release candidate pack includes optional business process DQ' -Passed $false -Detail $_.Exception.Message
}

$results | Format-Table Name, Passed, Detail -AutoSize
if (($results | Where-Object { -not $_.Passed }).Count -gt 0) {
    exit 1
}
