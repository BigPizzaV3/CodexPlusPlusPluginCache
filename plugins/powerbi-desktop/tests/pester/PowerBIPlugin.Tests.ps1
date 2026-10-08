$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'
$samplePath = Join-Path $pluginRoot 'examples/sample-model'

Describe 'Power BI Desktop plugin' {
    It 'parses the plugin manifest' {
        { Get-Content -Raw -LiteralPath (Join-Path $pluginRoot '.codex-plugin/plugin.json') | ConvertFrom-Json } | Should Not Throw
    }

    It 'includes the AI forecast entrypoint' {
        $scriptPath = Join-Path $scriptsPath 'Invoke-PowerBIAIForecast.ps1'
        Test-Path -LiteralPath $scriptPath | Should Be $true
        { & $scriptPath -DryRun -Json | ConvertFrom-Json } | Should Not Throw
    }

    It 'creates a source-driven model design pack without creating a PBIX binary' {
        $outputDirectory = Join-Path $pluginRoot 'tmp/pester-model-wizard'
        $source = Join-Path $pluginRoot 'examples/business-process-data/SalesOrder.csv'
        $wizard = & (Join-Path $scriptsPath 'New-PowerBIModelWizard.ps1') -ProjectName 'Source Driven Model' -DataSourcePaths $source -OutputDirectory $outputDirectory -Initialize -Json | ConvertFrom-Json

        $wizard.schema | Should Be 'codex.powerbi.modelWizard.v1'
        $wizard.architecture.pattern | Should Be 'StarSchema'
        $wizard.architecture.sourceProfiles[0].name | Should Be 'SalesOrder'
        Test-Path -LiteralPath (Join-Path $wizard.initializedDraftDirectory 'data-contract-draft.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $wizard.initializedDraftDirectory 'connection-drafts.json') | Should Be $true
    }

    It 'creates the next-generation Power BI and Fabric USP pack' {
        $outputDirectory = Join-Path $pluginRoot 'tmp/pester-nextgen-usps'
        $pack = & (Join-Path $scriptsPath 'Invoke-PowerBINextGenUspPack.ps1') -Path $samplePath -OutputDirectory $outputDirectory -Json | ConvertFrom-Json
        $pack.schema | Should Be 'codex.powerbi.nextGenUspPack.v1'
        $pack.artifactCount | Should Be 6
        Test-Path -LiteralPath $pack.artifacts.finOps | Should Be $true
        Test-Path -LiteralPath $pack.artifacts.copilotRegression | Should Be $true
        Test-Path -LiteralPath $pack.artifacts.directLake | Should Be $true
        Test-Path -LiteralPath $pack.artifacts.dataProductSlo | Should Be $true
        Test-Path -LiteralPath $pack.artifacts.capacityVerifier | Should Be $true
        Test-Path -LiteralPath $pack.artifacts.decisionTrace | Should Be $true
    }

    It 'creates eight local enterprise operations artifacts without service access' {
        $outputDirectory = Join-Path $pluginRoot 'tmp/pester-enterprise-operations'
        $pack = & (Join-Path $scriptsPath 'Invoke-PowerBIEnterpriseOperationsPack.ps1') -Path $samplePath -OutputDirectory $outputDirectory -Json | ConvertFrom-Json
        $bundle = Get-Content -Raw -LiteralPath (Join-Path $outputDirectory 'release-evidence-bundle.json') | ConvertFrom-Json

        $pack.schema | Should Be 'codex.powerbi.enterpriseOperationsPack.v1'
        $pack.artifactCount | Should Be 8
        $bundle.schema | Should Be 'codex.powerbi.releaseEvidenceBundle.v1'
        $bundle.status | Should Be 'ReadyForOwnerSignOff'
        Test-Path -LiteralPath (Join-Path $outputDirectory 'copilot-quality-monitor.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $outputDirectory 'plugin-quality-gate.json') | Should Be $true
    }

    It 'creates eight local decision intelligence artifacts without service access' {
        $outputDirectory = Join-Path $pluginRoot 'tmp/pester-decision-intelligence'
        $pack = & (Join-Path $scriptsPath 'Invoke-PowerBIDecisionIntelligencePack.ps1') -Path $samplePath -OutputDirectory $outputDirectory -Json | ConvertFrom-Json
        $copilot = Get-Content -Raw -LiteralPath (Join-Path $outputDirectory 'copilot-reliability-score.json') | ConvertFrom-Json
        $exceptions = Get-Content -Raw -LiteralPath (Join-Path $outputDirectory 'exception-approval-workflow.json') | ConvertFrom-Json

        $pack.schema | Should Be 'codex.powerbi.decisionIntelligencePack.v1'
        $pack.artifactCount | Should Be 8
        $copilot.schema | Should Be 'codex.powerbi.copilotReliabilityScore.v1'
        $exceptions.schema | Should Be 'codex.powerbi.exceptionApprovalWorkflow.v1'
        Test-Path -LiteralPath (Join-Path $outputDirectory 'visual-regression-evidence.json') | Should Be $true
    }

    It 'includes autonomous planning engine skills' {
        $skillsPath = Join-Path $pluginRoot 'skills'
        @(
            'powerbi-autonomous-planning-loop',
            'powerbi-goal-seeking-planning',
            'powerbi-constraint-aware-planning',
            'powerbi-revenue-digital-twin',
            'powerbi-autonomous-forecast-agents',
            'powerbi-autonomous-exception-management',
            'powerbi-revenue-rescue-mode',
            'powerbi-forecast-trust-market',
            'powerbi-causal-counterfactual-forecasting',
            'powerbi-self-healing-forecast-governance',
            'powerbi-planning-memory',
            'powerbi-planning-readiness-score',
            'powerbi-forecast-war-room'
        ) | ForEach-Object {
            $skillPath = Join-Path $skillsPath $_
            Test-Path -LiteralPath (Join-Path $skillPath 'SKILL.md') | Should Be $true
            (Get-Content -Raw -LiteralPath (Join-Path $skillPath 'SKILL.md')) | Should Match '^---'
        }
    }

    It 'generates KPI trust scores' {
        $trust = & (Join-Path $scriptsPath 'New-PowerBIKpiTrustScore.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $trust.metricCount | Should Be 5
        ($trust.overallTrustScore -ge 0) | Should Be $true
    }

    It 'creates local KPI SLO actions without release blocking' {
        $slo = & (Join-Path $scriptsPath 'New-PowerBIKpiSloActionList.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $slo.schema | Should Be 'codex.powerbi.kpiSloActionList.v1'
        $slo.itemCount | Should Be 5
        ($slo.items | Where-Object metricName -eq 'Total Sales').owner | Should Be 'Sales Analytics'
        ($slo.items | Where-Object metricName -ne 'Total Sales' | Where-Object status -eq 'NeedsOwnerSetup').Count | Should BeGreaterThan 0
    }

    It 'creates safe measure drafts' {
        $draft = & (Join-Path $scriptsPath 'New-PowerBIMeasureDraft.ps1') -TableName 'Sales' -MeasureName 'Average Sales' -Expression "DIVIDE([Total Sales], COUNTROWS('Sales'))" -Json | ConvertFrom-Json
        $draft.objectType | Should Be 'Measure'
        $draft.safety | Should Match 'Draft only'
    }

    It 'resolves live Desktop targets without requiring Desktop to be open' {
        $live = & (Join-Path $scriptsPath 'Get-PowerBIDesktopLiveConnection.ps1') -RequireSingle -Json | ConvertFrom-Json
        $live.schema | Should Be 'codex.powerbi.liveConnection.v1'
        (@('TargetResolved','AmbiguousLiveTarget','NoLiveTarget') -contains $live.status) | Should Be $true
    }

    It 'reports local ADOMD provider availability in the environment check' {
        $environment = & (Join-Path $scriptsPath 'Test-PowerBIEnvironment.ps1') -Json | ConvertFrom-Json
        ($environment.PSObject.Properties.Name -contains 'AdomdClient') | Should Be $true
    }

    It 'honors explicit live Desktop port selection' {
        $live = & (Join-Path $scriptsPath 'Get-PowerBIDesktopLiveConnection.ps1') -Port 12345 -Json | ConvertFrom-Json
        $live.status | Should Be 'TargetResolved'
        $live.target.connectionString | Should Be 'Data Source=localhost:12345'
        $live.target.source | Should Be 'Explicit'

        $serverLive = & (Join-Path $scriptsPath 'Get-PowerBIDesktopLiveConnection.ps1') -Server 'Data Source=localhost:54321' -Json | ConvertFrom-Json
        $serverLive.status | Should Be 'TargetResolved'
        $serverLive.target.connectionString | Should Be 'Data Source=localhost:54321'
    }

    It 'creates machine-readable live safety plans' {
        $plan = & (Join-Path $scriptsPath 'New-PowerBILiveSafetyPlan.ps1') -OperationType Mutating -DryRun -Json | ConvertFrom-Json
        $plan.schema | Should Be 'codex.powerbi.liveSafetyPlan.v1'
        $plan.mode | Should Be 'DryRun'
        $plan.allowedToExecute | Should Be $false
        ($plan.guardrails -join ' ') | Should Match 'No SaveChanges'
        ($plan.guardrails -join ' ') | Should Match 'No publish'
        ($plan.guardrails -join ' ') | Should Match 'No credential'
    }

    It 'reports live-vs-repo drift as unavailable when no live endpoint exists' {
        $drift = & (Join-Path $scriptsPath 'Compare-PowerBILiveRepoModel.ps1') -Path $samplePath -RequireSingle -Json | ConvertFrom-Json
        $drift.schema | Should Be 'codex.powerbi.liveRepoReconciliation.v1'
        (@('LiveUnavailable','NoDrift','DriftDetected') -contains $drift.liveStatus) | Should Be $true
        $drift.liveStatus | Should Not Be 'NotAvailable'
        $drift.repoMeasureCount | Should Be 5
        ($drift.repoTableCount -ge 1) | Should Be $true
    }

    It 'passes golden baselines' {
        $result = & (Join-Path $scriptsPath 'Test-PowerBIGoldenBaselines.ps1') -PluginRoot $pluginRoot -Json | ConvertFrom-Json
        $result.failedCount | Should Be 0
        ($result.checkCount -ge 20) | Should Be $true
    }

    It 'creates an External Tools registration file' {
        $outputPath = Join-Path $pluginRoot 'tmp/pester/Codex Power BI Workbench.pbitool.json'
        $registration = & (Join-Path $scriptsPath 'New-PowerBIExternalToolRegistration.ps1') -PluginRoot $pluginRoot -OutputPath $outputPath -Json | ConvertFrom-Json
        $registration.tool.name | Should Be 'Codex Power BI Workbench'
        (Test-Path -LiteralPath $registration.outputPath) | Should Be $true
    }

    It 'creates autonomous fix plans and KPI trust contracts' {
        $fixAgent = & (Join-Path $scriptsPath 'Invoke-PowerBIAutonomousFixAgent.ps1') -Path $samplePath -MaxFixes 1 -Json | ConvertFrom-Json
        $contract = & (Join-Path $scriptsPath 'New-PowerBIKpiTrustContract.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $fixAgent.fixCount | Should Be 1
        $contract.metricCount | Should Be 5
    }

    It 'answers local model questions and creates Fabric readiness plans' {
        $ask = & (Join-Path $scriptsPath 'Invoke-PowerBIAskModel.ps1') -Path $samplePath -Question 'Which sales measures matter?' -Json | ConvertFrom-Json
        $fabric = & (Join-Path $scriptsPath 'New-PowerBIFabricReadinessPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
        ($ask.matchCount -ge 1) | Should Be $true
        $fabric.stepCount | Should Be 5
    }

    It 'creates the 38-USP AI expansion artifacts' {
        $agentic = & (Join-Path $scriptsPath 'New-PowerBIAgenticRemediationPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $outcome = & (Join-Path $scriptsPath 'New-PowerBIBusinessOutcomeSimulator.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $semantic = & (Join-Path $scriptsPath 'New-PowerBISemanticLayerAutopilot.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $override = & (Join-Path $scriptsPath 'New-PowerBIHumanOverrideLearning.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $conflicts = & (Join-Path $scriptsPath 'New-PowerBICrossReportKpiConflictDetector.ps1') -Path $samplePath -ComparisonPath $samplePath -Json | ConvertFrom-Json
        $impactGate = & (Join-Path $scriptsPath 'New-PowerBIPBIPChangeImpactGate.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $fixtures = & (Join-Path $scriptsPath 'New-PowerBISemanticTestFixtureGenerator.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-semantic-fixtures') -Json | ConvertFrom-Json
        $signoff = & (Join-Path $scriptsPath 'New-PowerBIKpiOwnerSignoffWorkflow.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $blastRadius = & (Join-Path $scriptsPath 'New-PowerBIRefreshBlastRadiusAnalyzer.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $exposure = & (Join-Path $scriptsPath 'New-PowerBISensitiveDataExposureMap.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $capacityPlan = & (Join-Path $scriptsPath 'New-PowerBICapacityMitigationPlanner.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $retirement = & (Join-Path $scriptsPath 'New-PowerBIReportRetirementAdvisor.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $evidence = & (Join-Path $scriptsPath 'New-PowerBILiveValidationEvidenceRecorder.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-live-validation-evidence') -Json | ConvertFrom-Json
        $drift = & (Join-Path $scriptsPath 'New-PowerBISemanticContractDriftMonitor.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $persona = & (Join-Path $scriptsPath 'New-PowerBIRlsPersonaCoverageMatrix.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $agentic.schema | Should Be 'codex.powerbi.agenticRemediationPlan.v1'
        $outcome.schema | Should Be 'codex.powerbi.businessOutcomeSimulator.v1'
        $semantic.schema | Should Be 'codex.powerbi.semanticLayerAutopilot.v1'
        $override.schema | Should Be 'codex.powerbi.humanOverrideLearning.v1'
        $conflicts.schema | Should Be 'codex.powerbi.crossReportKpiConflicts.v1'
        $impactGate.schema | Should Be 'codex.powerbi.pbipChangeImpactGate.v1'
        $fixtures.schema | Should Be 'codex.powerbi.semanticTestFixtureGenerator.v1'
        $signoff.schema | Should Be 'codex.powerbi.kpiOwnerSignoffWorkflow.v1'
        $blastRadius.schema | Should Be 'codex.powerbi.refreshBlastRadius.v1'
        $exposure.schema | Should Be 'codex.powerbi.sensitiveDataExposureMap.v1'
        $capacityPlan.schema | Should Be 'codex.powerbi.capacityMitigationPlanner.v1'
        $retirement.schema | Should Be 'codex.powerbi.reportRetirementAdvisor.v1'
        $evidence.schema | Should Be 'codex.powerbi.liveValidationEvidenceRecorder.v1'
        $drift.schema | Should Be 'codex.powerbi.semanticContractDriftMonitor.v1'
        $persona.schema | Should Be 'codex.powerbi.rlsPersonaCoverageMatrix.v1'
        $agentic.itemCount | Should BeGreaterThan 0
        $semantic.metricCount | Should Be 5
        $override.status | Should Be 'NeedsOverrideInput'
        $fixtures.expectationCount | Should BeGreaterThan 0
        $signoff.signoffItemCount | Should BeGreaterThan 0
        $capacityPlan.mitigationCount | Should BeGreaterThan 0
    }

    It 'creates the 39-artifact Max AI review package' {
        $review = & (Join-Path $scriptsPath 'Invoke-PowerBIMaxAIReview.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-max-ai')
        $review.ArtifactCount | Should Be 39
        (Test-Path -LiteralPath $review.Index) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/trust-debt-ledger.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/usage-trust-matrix.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/agentic-remediation-plan.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/ai-governance-evidence-pack/summary.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/autonomous-qa-lab/summary.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/pbip-change-impact-gate.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/semantic-test-fixtures/measure-expectations.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/kpi-owner-signoff.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/refresh-blast-radius.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/sensitive-data-exposure.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/capacity-mitigation-plan.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/report-retirement-advisor.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/live-validation-evidence/summary.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/semantic-contract-drift.json')) | Should Be $true
        (Test-Path -LiteralPath (Join-Path $pluginRoot 'tmp/pester-max-ai/rls-persona-coverage.json')) | Should Be $true
    }

    It 'creates enterprise USP governance artifacts' {
        $trustDebt = & (Join-Path $scriptsPath 'New-PowerBITrustDebtLedger.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $incident = & (Join-Path $scriptsPath 'New-PowerBIKpiIncidentReport.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $rls = & (Join-Path $scriptsPath 'Test-PowerBIRlsLeakage.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $capacity = & (Join-Path $scriptsPath 'New-PowerBIFabricCapacityRiskForecast.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $duplicates = & (Join-Path $scriptsPath 'Find-PowerBIMetricDuplicates.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $usage = & (Join-Path $scriptsPath 'Import-PowerBIUsageSignals.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $usageTrust = & (Join-Path $scriptsPath 'New-PowerBIUsageTrustMatrix.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $trustDebt.schema | Should Be 'codex.powerbi.trustDebtLedger.v1'
        $incident.schema | Should Be 'codex.powerbi.kpiIncidentReport.v1'
        $rls.schema | Should Be 'codex.powerbi.rlsLeakage.v1'
        $capacity.schema | Should Be 'codex.powerbi.fabricCapacityRiskForecast.v1'
        $duplicates.schema | Should Be 'codex.powerbi.metricDuplicates.v1'
        $usage.schema | Should Be 'codex.powerbi.usageSignals.v1'
        $usageTrust.schema | Should Be 'codex.powerbi.usageTrustMatrix.v1'
        $trustDebt.debtItemCount | Should Be 5
        $incident.affectedMeasures.Count | Should BeGreaterThan 0
        $usageTrust.metricCount | Should Be 5
    }

    It 'creates analytical release QA artifacts' {
        $methodology = & (Join-Path $scriptsPath 'Test-PowerBIAnalysisMethodology.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $diagnosis = & (Join-Path $scriptsPath 'New-PowerBIMetricChangeDiagnosis.ps1') -Path $samplePath -MetricName 'Total Sales' -Json | ConvertFrom-Json
        $missingDiagnosis = & (Join-Path $scriptsPath 'New-PowerBIMetricChangeDiagnosis.ps1') -Path $samplePath -MetricName 'Missing Metric' -Json | ConvertFrom-Json
        $reportPath = Join-Path $pluginRoot 'tmp/pester-analytical-release-report.md'
        $report = & (Join-Path $scriptsPath 'New-PowerBIAnalyticalReleaseReport.ps1') -Path $samplePath -Json | ConvertFrom-Json
        & (Join-Path $scriptsPath 'New-PowerBIAnalyticalReleaseReport.ps1') -Path $samplePath -OutputPath $reportPath | Out-Null

        $methodology.schema | Should Be 'codex.powerbi.analysisMethodologyValidation.v1'
        $methodology.assessment | Should Be 'ShareWithCaveats'
        $methodology.checks.missingOwnerCount | Should BeGreaterThan 0
        $methodology.checks.pendingSemanticTestCount | Should BeGreaterThan 0
        $diagnosis.schema | Should Be 'codex.powerbi.metricChangeDiagnosis.v1'
        $diagnosis.status | Should Be 'NeedsComparisonEvidence'
        $missingDiagnosis.status | Should Be 'MetricNotFound'
        $report.schema | Should Be 'codex.powerbi.analyticalReleaseReport.v1'
        $report.methodologyAssessment | Should Be 'ShareWithCaveats'
        $report.markdown | Should Match 'Release Readiness'
        $report.markdown | Should Match 'KPI Trust Findings'
        (Get-Content -Raw -LiteralPath $reportPath) | Should Match 'Methodology And Data Quality Caveats'
    }

    It 'creates advanced release USP artifacts' {
        $evidence = & (Join-Path $scriptsPath 'New-PowerBIEvidenceGraph.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $daxRisk = & (Join-Path $scriptsPath 'New-PowerBIDaxChangeRiskClassifier.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $contract = & (Join-Path $scriptsPath 'Test-PowerBISemanticContract.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $freshness = & (Join-Path $scriptsPath 'Test-PowerBIDataFreshnessLineageGate.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $brief = & (Join-Path $scriptsPath 'New-PowerBIExecutiveTrustBrief.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $watchlist = & (Join-Path $scriptsPath 'New-PowerBIKpiDriftWatchlist.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $rlsTrust = & (Join-Path $scriptsPath 'New-PowerBIRlsTrustReview.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $uxRegression = & (Join-Path $scriptsPath 'New-PowerBIReportUxRegressionScanner.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $migration = & (Join-Path $scriptsPath 'Test-PowerBIMigrationReadiness.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $evidence.schema | Should Be 'codex.powerbi.evidenceGraph.v1'
        $daxRisk.schema | Should Be 'codex.powerbi.daxChangeRiskClassifier.v1'
        $contract.schema | Should Be 'codex.powerbi.semanticContractTest.v1'
        $freshness.schema | Should Be 'codex.powerbi.dataFreshnessLineageGate.v1'
        $brief.schema | Should Be 'codex.powerbi.executiveTrustBrief.v1'
        $watchlist.schema | Should Be 'codex.powerbi.kpiDriftWatchlist.v1'
        $rlsTrust.schema | Should Be 'codex.powerbi.rlsTrustReview.v1'
        $uxRegression.schema | Should Be 'codex.powerbi.reportUxRegressionScanner.v1'
        $migration.schema | Should Be 'codex.powerbi.migrationReadiness.v1'
        $evidence.nodeCount | Should BeGreaterThan 0
        $contract.status | Should Be 'ContractFailed'
        $brief.markdown | Should Match 'Decision'
        $watchlist.itemCount | Should Be 5
        $migration.status | Should Be 'NotReady'
    }

    It 'creates portfolio, compliance, and operations governance artifacts' {
        $portfolio = & (Join-Path $scriptsPath 'New-PowerBIPortfolioCommandCenter.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $pipeline = & (Join-Path $scriptsPath 'Test-PowerBIDeploymentPipelineGate.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $certified = & (Join-Path $scriptsPath 'Test-PowerBICertifiedDatasetReadiness.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $costTrust = & (Join-Path $scriptsPath 'New-PowerBICostToTrustOptimizer.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $tenant = & (Join-Path $scriptsPath 'New-PowerBITenantHygieneScanner.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $conflictResolution = & (Join-Path $scriptsPath 'Resolve-PowerBIKpiDefinitionConflict.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $accessibility = & (Join-Path $scriptsPath 'Test-PowerBIReportAccessibilityCompliance.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $pqContract = & (Join-Path $scriptsPath 'Test-PowerBIPowerQueryDataContract.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $refreshAdvisor = & (Join-Path $scriptsPath 'New-PowerBIRefreshFailureRootCauseAdvisor.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $coverage = & (Join-Path $scriptsPath 'New-PowerBISemanticTestCoverageScore.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $signature = & (Join-Path $scriptsPath 'New-PowerBIReleaseEvidenceSignature.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $sla = & (Join-Path $scriptsPath 'New-PowerBIBusinessKpiSlaMonitor.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $portfolio.schema | Should Be 'codex.powerbi.portfolioCommandCenter.v1'
        $pipeline.schema | Should Be 'codex.powerbi.deploymentPipelineGate.v1'
        $certified.schema | Should Be 'codex.powerbi.certifiedDatasetReadiness.v1'
        $costTrust.schema | Should Be 'codex.powerbi.costToTrustOptimizer.v1'
        $tenant.schema | Should Be 'codex.powerbi.tenantHygieneScanner.v1'
        $conflictResolution.schema | Should Be 'codex.powerbi.kpiDefinitionConflictResolution.v1'
        $accessibility.schema | Should Be 'codex.powerbi.reportAccessibilityCompliance.v1'
        $pqContract.schema | Should Be 'codex.powerbi.powerQueryDataContract.v1'
        $refreshAdvisor.schema | Should Be 'codex.powerbi.refreshFailureRootCauseAdvisor.v1'
        $coverage.schema | Should Be 'codex.powerbi.semanticTestCoverageScore.v1'
        $signature.schema | Should Be 'codex.powerbi.releaseEvidenceSignature.v1'
        $sla.schema | Should Be 'codex.powerbi.businessKpiSlaMonitor.v1'
        $portfolio.status | Should Be 'NeedsGovernanceReview'
        $pipeline.decision | Should Be 'BlockPromotion'
        $tenant.status | Should Be 'NeedsTenantExport'
        $coverage.status | Should Be 'Weak'
        $sla.breachedCount | Should Be 5
    }

    It 'creates Fabric live read-only access plans, snapshots, and Max-USP artifacts' {
        $snapshotPath = Join-Path $pluginRoot 'examples/fabric-snapshot/minimal'
        $accessPlan = & (Join-Path $scriptsPath 'Get-PowerBIFabricAccessPlan.ps1') -WorkspaceName 'Demo Workspace' -Json | ConvertFrom-Json
        $blocked = & (Join-Path $scriptsPath 'Invoke-PowerBIFabricReadOnlyRequest.ps1') -Uri 'https://api.powerbi.com/v1.0/myorg/groups' -Method POST -Json | ConvertFrom-Json
        $snapshot = & (Join-Path $scriptsPath 'Import-PowerBIFabricWorkspaceSnapshot.ps1') -SnapshotDirectory $snapshotPath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-fabric-snapshot') -Json | ConvertFrom-Json
        $tenantSnapshot = & (Join-Path $scriptsPath 'Import-PowerBIFabricTenantSnapshot.ps1') -SnapshotDirectory $snapshotPath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-fabric-tenant-snapshot') -Json | ConvertFrom-Json
        $portfolio = & (Join-Path $scriptsPath 'New-PowerBIFabricPortfolioCommandCenter.ps1') -SnapshotDirectory $snapshotPath -Json | ConvertFrom-Json
        $deploy = & (Join-Path $scriptsPath 'Test-PowerBIFabricDeploymentPipelineGate.ps1') -SnapshotDirectory $snapshotPath -Json | ConvertFrom-Json
        $refresh = & (Join-Path $scriptsPath 'New-PowerBIFabricRefreshFailureRootCauseAdvisor.ps1') -SnapshotDirectory $snapshotPath -Json | ConvertFrom-Json
        $lineage = & (Join-Path $scriptsPath 'New-PowerBIFabricLineageEvidenceGraph.ps1') -SnapshotDirectory $snapshotPath -Json | ConvertFrom-Json
        $executive = & (Join-Path $scriptsPath 'New-PowerBIFabricExecutiveWarRoom.ps1') -SnapshotDirectory $snapshotPath -Json | ConvertFrom-Json

        $accessPlan.schema | Should Be 'codex.powerbi.fabricAccessPlan.v1'
        $accessPlan.status | Should Be 'NeedsAccessPlan'
        $blocked.status | Should Be 'BlockedUnsafeMethod'
        $snapshot.Status | Should Be 'SnapshotReady'
        $tenantSnapshot.Status | Should Be 'SnapshotReady'
        $portfolio.schema | Should Be 'codex.powerbi.fabricPortfolioCommandCenter.v1'
        $deploy.schema | Should Be 'codex.powerbi.fabricDeploymentPipelineGate.v1'
        $refresh.schema | Should Be 'codex.powerbi.fabricRefreshFailureRootCauseAdvisor.v1'
        $lineage.schema | Should Be 'codex.powerbi.fabricLineageEvidenceGraph.v1'
        $executive.schema | Should Be 'codex.powerbi.fabricExecutiveWarRoom.v1'
        $lineage.evidenceStrength | Should Be 'Medium'
    }

    It 'classifies feature maturity and render evidence explicitly' {
        $maturity = & (Join-Path $scriptsPath 'New-PowerBIFeatureMaturityMap.ps1') -Json | ConvertFrom-Json
        $render = & (Join-Path $scriptsPath 'Test-PowerBIReportRenderReadiness.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $maturity.schema | Should Be 'codex.powerbi.featureMaturityMap.v1'
        $maturity.featureCount | Should BeGreaterThan 5
        @($maturity.features | Where-Object maturity -eq 'LiveReadOrSnapshot').Count | Should BeGreaterThan 0
        @($maturity.features | Where-Object maturity -eq 'DraftAndApply').Count | Should BeGreaterThan 0
        $render.schema | Should Be 'codex.powerbi.reportRenderReadiness.v1'
        (@('EvidenceBacked','MetadataOnly','Blocked') -contains $render.evidenceMaturity) | Should Be $true
        $render.readyForAutomatedPublish | Should Be $false
    }

    It 'reports PBIP roundtrip structure checks as machine-readable JSON' {
        $pbipRoot = Join-Path $pluginRoot 'tmp/pester-pbip-roundtrip'
        $semanticRoot = Join-Path $pbipRoot 'Demo.SemanticModel'
        $reportRoot = Join-Path $pbipRoot 'Demo.Report'
        New-Item -ItemType Directory -Force -Path $semanticRoot | Out-Null
        New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null
        Set-Content -LiteralPath (Join-Path $pbipRoot 'Demo.pbip') -Value '{}' -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $semanticRoot 'model.tmdl') -Value 'model Demo' -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $semanticRoot '.platform') -Value '{}' -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $reportRoot 'definition.pbir') -Value '{}' -Encoding UTF8

        $structure = & (Join-Path $scriptsPath 'Get-PowerBIPBIPStructure.ps1') -Path $pbipRoot -Json | ConvertFrom-Json
        $structure.schema | Should Be 'codex.powerbi.pbipStructure.v1'
        $structure.roundtripStatus | Should Be 'Ready'
        @($structure.checks).Count | Should BeGreaterThan 4
    }

    It 'creates a PBIX compile workflow warning when pbi-tools is unavailable or structure is incomplete' {
        $pbipRoot = Join-Path $pluginRoot 'tmp/pester-pbip-compile'
        New-Item -ItemType Directory -Force -Path $pbipRoot | Out-Null
        $pbipPath = Join-Path $pbipRoot 'Incomplete.pbip'
        Set-Content -LiteralPath $pbipPath -Value '{}' -Encoding UTF8

        $workflow = & (Join-Path $scriptsPath 'New-PowerBIPBIXCompileWorkflow.ps1') -PbipPath $pbipPath -OutputPbix (Join-Path $pbipRoot 'Candidate.pbix') -Json | ConvertFrom-Json
        $workflow.schema | Should Be 'codex.powerbi.pbixCompileWorkflow.v1'
        $workflow.status | Should Be 'Warning'
        $workflow.pbipStructure.roundtripStatus | Should Be 'Incomplete'
        @($workflow.validationPlan).Count | Should BeGreaterThan 2
    }

    It 'emits governance policy and release gate machine-readable warning fields' {
        $policy = & (Join-Path $scriptsPath 'New-PowerBIGovernancePolicyPack.ps1') -Json | ConvertFrom-Json
        $gate = & (Join-Path $scriptsPath 'New-PowerBITrustReleaseGate.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $policy.gatePolicy.machineReadableResultsRequired | Should Be $true
        @($policy.rules | Where-Object id -eq 'semantic-tests-pending').Count | Should Be 1
        $gate.schema | Should Be 'codex.powerbi.trustReleaseGate.v2'
        $gate.machineReadable | Should Be $true
        $gate.pendingSemanticTestCount | Should BeGreaterThan 0
        @($gate.checks | Where-Object id -eq 'fixes.openP1').Count | Should Be 1
        @($gate.checks | Where-Object id -eq 'live.availability').Count | Should Be 1
    }

    It 'includes analytical QA in release candidate packs when requested' {
        $packRoot = Join-Path $pluginRoot 'tmp/pester-release-analytical-qa'
        $pack = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory $packRoot -SkipLive -IncludeAnalyticalQa
        $summary = Get-Content -Raw -LiteralPath $pack.Summary | ConvertFrom-Json

        $summary.schema | Should Be 'codex.powerbi.releaseCandidatePack.v1'
        $summary.enterpriseUsps.analyticalQaStatus | Should Be 'NeedsRevision'
        $summary.enterpriseUsps.metricDiagnosisStatus | Should Be 'NeedsComparisonEvidence'
        Test-Path -LiteralPath (Join-Path $packRoot 'analysis-methodology-validation.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'metric-change-diagnosis.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'analytical-release-report.md') | Should Be $true
    }

    It 'includes advanced USP QA in release candidate packs when requested' {
        $packRoot = Join-Path $pluginRoot 'tmp/pester-release-advanced-usp-qa'
        $pack = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory $packRoot -SkipLive -IncludeAdvancedUspQa
        $summary = Get-Content -Raw -LiteralPath $pack.Summary | ConvertFrom-Json

        $summary.schema | Should Be 'codex.powerbi.releaseCandidatePack.v1'
        $summary.enterpriseUsps.evidenceGraphStrength | Should Be 'Medium'
        $summary.enterpriseUsps.semanticContractStatus | Should Be 'ContractFailed'
        $summary.enterpriseUsps.rlsTrustReviewStatus | Should Be 'Blocked'
        Test-Path -LiteralPath (Join-Path $packRoot 'evidence-graph.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'executive-trust-brief.md') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'migration-readiness.json') | Should Be $true
    }

    It 'includes separated portfolio, compliance, and operations QA in release candidate packs when requested' {
        $packRoot = Join-Path $pluginRoot 'tmp/pester-release-separated-governance-qa'
        $pack = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory $packRoot -SkipLive -IncludePortfolioGovernanceQa -IncludeComplianceQa -IncludeOperationsQa
        $summary = Get-Content -Raw -LiteralPath $pack.Summary | ConvertFrom-Json

        $summary.enterpriseUsps.portfolioCommandCenterStatus | Should Be 'NeedsGovernanceReview'
        $summary.enterpriseUsps.deploymentPipelineDecision | Should Be 'BlockPromotion'
        $summary.enterpriseUsps.semanticTestCoverageStatus | Should Be 'Weak'
        Test-Path -LiteralPath (Join-Path $packRoot 'portfolio-command-center.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'deployment-pipeline-gate.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'business-kpi-sla-monitor.json') | Should Be $true
    }

    It 'includes Fabric live snapshot QA in release candidate packs when requested' {
        $packRoot = Join-Path $pluginRoot 'tmp/pester-release-fabric-qa'
        $snapshotPath = Join-Path $pluginRoot 'examples/fabric-snapshot/minimal'
        $pack = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory $packRoot -SkipLive -IncludeFabricLiveQa -IncludeFabricPortfolioQa -IncludeFabricDeploymentQa -IncludeFabricOperationsQa -IncludeFabricGovernanceQa -IncludeFabricExecutiveQa -SnapshotDirectory $snapshotPath
        $summary = Get-Content -Raw -LiteralPath $pack.Summary | ConvertFrom-Json

        $summary.enterpriseUsps.fabricLiveStatus | Should Be 'SnapshotReady'
        $summary.enterpriseUsps.fabricPortfolioStatus | Should Be 'PortfolioStable'
        $summary.enterpriseUsps.fabricDeploymentDecision | Should Be 'Promote'
        $summary.enterpriseUsps.fabricLineageEvidenceStrength | Should Be 'Medium'
        Test-Path -LiteralPath (Join-Path $packRoot 'fabric-workspace-snapshot/summary.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'fabric-portfolio-command-center.json') | Should Be $true
        Test-Path -LiteralPath (Join-Path $packRoot 'fabric-executive-war-room.json') | Should Be $true
    }

    It 'creates a Fabric access plan when live QA lacks token and workspace scope' {
        $packRoot = Join-Path $pluginRoot 'tmp/pester-release-fabric-access-plan'
        $pack = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory $packRoot -SkipLive -IncludeFabricLiveQa
        $summary = Get-Content -Raw -LiteralPath $pack.Summary | ConvertFrom-Json

        $summary.enterpriseUsps.fabricLiveStatus | Should Be 'NeedsAccessPlan'
        Test-Path -LiteralPath (Join-Path $packRoot 'fabric-access-plan.json') | Should Be $true
    }
}
