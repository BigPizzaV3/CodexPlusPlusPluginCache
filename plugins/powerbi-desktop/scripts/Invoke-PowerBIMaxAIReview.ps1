param([string]$Path='.', [string]$OutputDirectory='powerbi-max-ai-review')
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$out=$ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out|Out-Null
$outputs=[ordered]@{
 FixUntilGreen=Join-Path $out 'fix-until-green.md'; CopilotEvaluator=Join-Path $out 'semantic-copilot-evaluator.md'; DataContract=Join-Path $out 'data-contract.md'; FabricDeploymentRisk=Join-Path $out 'fabric-deployment-risk.md'; VisualIntent=Join-Path $out 'visual-intent.md'; RootCauseGraph=Join-Path $out 'root-cause-graph.md'; KpiTrustTwin=Join-Path $out 'kpi-trust-twin.json'; ReviewMemory=Join-Path $out 'review-memory.json'; ReviewMemoryStore=Join-Path $out 'review-memory-store.json'; NaturalLanguageAuthoring=Join-Path $out 'natural-language-authoring.json'; GovernanceRuleMiner=Join-Path $out 'governance-rule-miner.md'; ExplainableDaxRefactoring=Join-Path $out 'explainable-dax-refactoring.md'; ReportDecisionSimulator=Join-Path $out 'report-decision-simulator.md'; TrustDebtLedger=Join-Path $out 'trust-debt-ledger.json'; KpiIncidentReport=Join-Path $out 'kpi-incident-report.json'; RlsLeakage=Join-Path $out 'rls-leakage.json'; FabricCapacityRisk=Join-Path $out 'fabric-capacity-risk.json'; MetricDuplicates=Join-Path $out 'metric-duplicates.json'; ForecastExceptionBoard=Join-Path $out 'forecast-exception-board.json'; UsageSignals=Join-Path $out 'usage-signals.json'; UsageTrustMatrix=Join-Path $out 'usage-trust-matrix.json'; RollbackReadiness=Join-Path $out 'pbip-rollback-readiness.json'; AgenticRemediationPlan=Join-Path $out 'agentic-remediation-plan.json'; BusinessOutcomeSimulation=Join-Path $out 'business-outcome-simulation.json'; SemanticLayerAutopilot=Join-Path $out 'semantic-layer-autopilot.json'; AIGovernanceEvidencePack=Join-Path $out 'ai-governance-evidence-pack/summary.json'; HumanOverrideLearning=Join-Path $out 'human-override-learning.json'; CrossReportKpiConflicts=Join-Path $out 'cross-report-kpi-conflicts.json'; ExecutiveNarrativeQuality=Join-Path $out 'executive-narrative-quality.json'; AutonomousQALab=Join-Path $out 'autonomous-qa-lab/summary.json'; ChangeImpactGate=Join-Path $out 'pbip-change-impact-gate.json'; SemanticTestFixtures=Join-Path $out 'semantic-test-fixtures/measure-expectations.json'; KpiOwnerSignoff=Join-Path $out 'kpi-owner-signoff.json'; RefreshBlastRadius=Join-Path $out 'refresh-blast-radius.json'; SensitiveDataExposure=Join-Path $out 'sensitive-data-exposure.json'; CapacityMitigationPlan=Join-Path $out 'capacity-mitigation-plan.json'; ReportRetirementAdvisor=Join-Path $out 'report-retirement-advisor.json'; LiveValidationEvidence=Join-Path $out 'live-validation-evidence/summary.json'; SemanticContractDrift=Join-Path $out 'semantic-contract-drift.json'; RlsPersonaCoverage=Join-Path $out 'rls-persona-coverage.json'
}
& (Join-Path $scriptRoot 'Invoke-PowerBIFixUntilGreenLoop.ps1') -Path $Path -OutputPath $outputs.FixUntilGreen|Out-Null
& (Join-Path $scriptRoot 'Test-PowerBISemanticModelCopilotEvaluator.ps1') -Path $Path -OutputPath $outputs.CopilotEvaluator|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIDataContract.ps1') -Path $Path -OutputPath $outputs.DataContract|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIFabricDeploymentRiskSimulator.ps1') -Path $Path -OutputPath $outputs.FabricDeploymentRisk|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIVisualIntentAnalyzer.ps1') -Path $Path -OutputPath $outputs.VisualIntent|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIBrokenMeasureRootCauseGraph.ps1') -Path $Path -OutputPath $outputs.RootCauseGraph|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIKpiTrustTwin.ps1') -Path $Path -Json -OutputPath $outputs.KpiTrustTwin|Out-Null
& (Join-Path $scriptRoot 'Update-PowerBIReviewMemory.ps1') -Path $Path -MemoryPath $outputs.ReviewMemoryStore -Json -OutputPath $outputs.ReviewMemory|Out-Null
& (Join-Path $scriptRoot 'New-PowerBINaturalLanguagePBIPAuthoring.ps1') -Path $Path -Intent 'Create an executive overview with the most important risk and trust KPIs.' -Json -OutputPath $outputs.NaturalLanguageAuthoring|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIGovernanceRuleMiner.ps1') -Path $Path -OutputPath $outputs.GovernanceRuleMiner|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIExplainableDaxRefactoring.ps1') -Path $Path -OutputPath $outputs.ExplainableDaxRefactoring|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIReportDecisionSimulator.ps1') -Path $Path -OutputPath $outputs.ReportDecisionSimulator|Out-Null
& (Join-Path $scriptRoot 'New-PowerBITrustDebtLedger.ps1') -Path $Path -Json -OutputPath $outputs.TrustDebtLedger|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIKpiIncidentReport.ps1') -Path $Path -Json -OutputPath $outputs.KpiIncidentReport|Out-Null
& (Join-Path $scriptRoot 'Test-PowerBIRlsLeakage.ps1') -Path $Path -Json -OutputPath $outputs.RlsLeakage|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIFabricCapacityRiskForecast.ps1') -Path $Path -Json -OutputPath $outputs.FabricCapacityRisk|Out-Null
& (Join-Path $scriptRoot 'Find-PowerBIMetricDuplicates.ps1') -Path $Path -Json -OutputPath $outputs.MetricDuplicates|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIForecastExceptionBoard.ps1') -Path $Path -Json -OutputPath $outputs.ForecastExceptionBoard|Out-Null
& (Join-Path $scriptRoot 'Import-PowerBIUsageSignals.ps1') -Path $Path -Json -OutputPath $outputs.UsageSignals|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIUsageTrustMatrix.ps1') -Path $Path -UsageSignalsPath $outputs.UsageSignals -Json -OutputPath $outputs.UsageTrustMatrix|Out-Null
& (Join-Path $scriptRoot 'Test-PowerBIPBIPRollbackReadiness.ps1') -PbipPath $Path -Json -OutputPath $outputs.RollbackReadiness|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIAgenticRemediationPlan.ps1') -Path $Path -Json -OutputPath $outputs.AgenticRemediationPlan|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIBusinessOutcomeSimulator.ps1') -Path $Path -Json -OutputPath $outputs.BusinessOutcomeSimulation|Out-Null
& (Join-Path $scriptRoot 'New-PowerBISemanticLayerAutopilot.ps1') -Path $Path -Json -OutputPath $outputs.SemanticLayerAutopilot|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIAIGovernanceEvidencePack.ps1') -Path $Path -OutputDirectory (Split-Path -Parent $outputs.AIGovernanceEvidencePack) -Json|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIHumanOverrideLearning.ps1') -Path $Path -Json -OutputPath $outputs.HumanOverrideLearning|Out-Null
& (Join-Path $scriptRoot 'New-PowerBICrossReportKpiConflictDetector.ps1') -Path $Path -Json -OutputPath $outputs.CrossReportKpiConflicts|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIExecutiveNarrativeQualityAgent.ps1') -Path $Path -Json -OutputPath $outputs.ExecutiveNarrativeQuality|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIAutonomousQALab.ps1') -Path $Path -OutputDirectory (Split-Path -Parent $outputs.AutonomousQALab) -Json|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIPBIPChangeImpactGate.ps1') -Path $Path -Json -OutputPath $outputs.ChangeImpactGate|Out-Null
& (Join-Path $scriptRoot 'New-PowerBISemanticTestFixtureGenerator.ps1') -Path $Path -OutputDirectory (Split-Path -Parent $outputs.SemanticTestFixtures) -Json|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIKpiOwnerSignoffWorkflow.ps1') -Path $Path -Json -OutputPath $outputs.KpiOwnerSignoff|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIRefreshBlastRadiusAnalyzer.ps1') -Path $Path -Json -OutputPath $outputs.RefreshBlastRadius|Out-Null
& (Join-Path $scriptRoot 'New-PowerBISensitiveDataExposureMap.ps1') -Path $Path -Json -OutputPath $outputs.SensitiveDataExposure|Out-Null
& (Join-Path $scriptRoot 'New-PowerBICapacityMitigationPlanner.ps1') -Path $Path -Json -OutputPath $outputs.CapacityMitigationPlan|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIReportRetirementAdvisor.ps1') -Path $Path -Json -OutputPath $outputs.ReportRetirementAdvisor|Out-Null
& (Join-Path $scriptRoot 'New-PowerBILiveValidationEvidenceRecorder.ps1') -Path $Path -OutputDirectory (Split-Path -Parent $outputs.LiveValidationEvidence) -Json|Out-Null
& (Join-Path $scriptRoot 'New-PowerBISemanticContractDriftMonitor.ps1') -Path $Path -Json -OutputPath $outputs.SemanticContractDrift|Out-Null
& (Join-Path $scriptRoot 'New-PowerBIRlsPersonaCoverageMatrix.ps1') -Path $Path -Json -OutputPath $outputs.RlsPersonaCoverage|Out-Null
$artifactCount = @($outputs.GetEnumerator() | Where-Object { $_.Key -ne 'ReviewMemoryStore' }).Count
$index=@('# Power BI Max AI Review','',('Source: `{0}`' -f (Resolve-Path -LiteralPath $Path).Path),('Generated: {0}' -f (Get-Date).ToString('s')),('Artifact count: {0}' -f $artifactCount),'','## Artifacts')+@($outputs.GetEnumerator()|Where-Object{$_.Key -ne 'ReviewMemoryStore'}|ForEach-Object{ '- {0}: `{1}`' -f $_.Key, $_.Value })
$indexPath=Join-Path $out 'README.md'; Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine)+[Environment]::NewLine) -Encoding UTF8
[pscustomobject]@{OutputDirectory=$out;Index=$indexPath;ArtifactCount=$artifactCount}
