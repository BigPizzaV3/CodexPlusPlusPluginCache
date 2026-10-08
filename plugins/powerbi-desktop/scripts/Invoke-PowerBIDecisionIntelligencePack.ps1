param(
    [string]$Path = '.',
    [string]$OutputDirectory = 'powerbi-decision-intelligence-pack',
    [string]$KpiBaselinePath,
    [string]$CopilotAnswersPath,
    [string]$ScenarioPath,
    [string]$DecisionRecordsPath,
    [string]$PortfolioPath,
    [string]$BaselineScreenshotPath,
    [string]$CandidateScreenshotPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null
function Save-Artifact { param([string]$Name, $Value) $target=Join-Path $out $Name; $Value | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $target -Encoding UTF8; $target }
function Read-OptionalJson { param([string]$InputPath) if ($InputPath -and (Test-Path -LiteralPath $InputPath)) { Get-Content -Raw -LiteralPath $InputPath | ConvertFrom-Json } }
function Get-Collection { param($Value,[string]$Property) if ($null -eq $Value) { @() } elseif ($Property -and $Value.PSObject.Properties.Name -contains $Property) { @($Value.$Property) } else { @($Value) } }

$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$copilotReadiness = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $Path -Json | ConvertFrom-Json
$copilotQuestions = & (Join-Path $scriptRoot 'Test-PowerBISemanticModelCopilotEvaluator.ps1') -Path $Path -Json | ConvertFrom-Json
$semanticContract = & (Join-Path $scriptRoot 'New-PowerBISemanticContractDriftMonitor.ps1') -Path $Path -Json | ConvertFrom-Json

# 1. Reviewer-approved answer captures turn Copilot readiness into an explicit reliability score.
$answerInput = Read-OptionalJson $CopilotAnswersPath
$answers = Get-Collection $answerInput 'answers'
$answerReviews = @($copilotQuestions.questions | ForEach-Object {
    $question = $_
    $answer = @($answers | Where-Object { $_.metricName -eq $question.targetMeasure -or $_.question -eq $question.question } | Select-Object -First 1)
    $grounded = [bool]($answer -and $answer.grounded -eq $true)
    $approved = [bool]($answer -and $answer.approved -eq $true)
    [pscustomobject]@{ metricName=$question.targetMeasure; question=$question.question; answerCaptured=[bool]$answer; grounded=$grounded; approved=$approved; status=if(-not $answer){'PendingCapture'}elseif($approved -and $grounded){'Reliable'}else{'NeedsReview'} }
})
$reliable = @($answerReviews | Where-Object status -eq 'Reliable').Count
$reliabilityScore = if ($answerReviews.Count) { [math]::Round((($reliable / $answerReviews.Count) * 70) + ([math]::Min([double]$copilotReadiness.score,30)),1) } else { 0 }
$copilot = [pscustomobject]@{schema='codex.powerbi.copilotReliabilityScore.v1'; evidenceMaturity=if($answers.Count){'ReviewerCapturedAnswers'}else{'ReadinessAndTestPlan'}; score=$reliabilityScore; questionCount=$answerReviews.Count; reliableAnswerCount=$reliable; status=if($answers.Count -eq 0){'NeedsAnswerCapture'}elseif($reliabilityScore -ge 80){'ReliableWithEvidence'}else{'NeedsReliabilityWork'}; reviews=$answerReviews; nextAction='Capture answer, grounding evidence, reviewer decision, and optional CU cost for each priority question.'}
$copilotPath=Save-Artifact 'copilot-reliability-score.json' $copilot

# 2. KPI explanations compare an exported prior trust score with current evidence, never invented values.
$baseline = Read-OptionalJson $KpiBaselinePath
$baselineMetrics = Get-Collection $baseline 'metrics'
$changes = @($trust.metrics | ForEach-Object {
    $metric=$_; $prior=@($baselineMetrics | Where-Object name -eq $metric.name | Select-Object -First 1)
    $delta=if($prior){[int]$metric.trustScore-[int]$prior.trustScore}else{$null}
    $drivers=@(); if(-not $prior){$drivers+='No comparable baseline was supplied.'} elseif($delta -lt 0){$drivers+='Trust evidence declined; inspect definition, freshness, semantic tests, and owner changes.'} elseif($delta -gt 0){$drivers+='Trust evidence improved; retain the supporting evidence in the decision record.'} else {$drivers+='Trust score is unchanged; inspect business-value changes separately.'}
    [pscustomobject]@{metricName=$metric.name; currentTrustScore=$metric.trustScore; baselineTrustScore=if($prior){$prior.trustScore}else{$null}; trustScoreDelta=$delta; confidence=if($prior){'EvidenceBacked'}else{'BaselineRequired'}; drivers=$drivers; nextAction='Validate change drivers against refresh, lineage, and business events.'}
})
$changeExplanation=[pscustomobject]@{schema='codex.powerbi.kpiChangeExplanation.v1'; evidenceMaturity=if($baselineMetrics.Count){'LocalBaselineComparison'}else{'BaselineRequired'}; itemCount=$changes.Count; explanations=$changes; nextAction='Persist an approved trust-score export after each release, then compare it to the next run.'}
$changePath=Save-Artifact 'kpi-change-explanations.json' $changeExplanation

# 3. A transparent scenario model links driver assumptions to KPI effects; it is not a forecast claim.
$scenarioInput=Read-OptionalJson $ScenarioPath
$drivers=Get-Collection $scenarioInput 'drivers'
if(-not $drivers.Count){$drivers=@([pscustomobject]@{name='Revenue';changePercent=0},[pscustomobject]@{name='Price';changePercent=0},[pscustomobject]@{name='Demand';changePercent=0},[pscustomobject]@{name='DeliveryTime';changePercent=0})}
$impact=@($trust.metrics | ForEach-Object { $metric=$_; $total=[math]::Round((@($drivers | Measure-Object changePercent -Sum).Sum),2); [pscustomobject]@{metricName=$metric.name; assumedDriverChangePercent=$total; estimatedDirectionalImpact=if($total -gt 0){'Positive'}elseif($total -lt 0){'Negative'}else{'NoChange'}; confidence='AssumptionOnly'; requiredValidation=@('business owner','actuals after refresh','semantic test')}})
$simulation=[pscustomobject]@{schema='codex.powerbi.businessImpactSimulation.v1'; evidenceMaturity='ScenarioAssumptions'; drivers=$drivers; kpiImpacts=$impact; disclaimer='This is a directional scenario calculation, not a predictive forecast or a committed business result.'; nextAction='Replace assumptions with approved elasticities or forecast evidence before decision use.'}
$simulationPath=Save-Artifact 'business-impact-simulation.json' $simulation

# 4. Existing semantic-contract drift becomes a team-facing release contract and waiver queue.
$contractItems=@($semanticContract.drifts | ForEach-Object {[pscustomobject]@{metricName=$_.metric; issues=$_.issues; ownerDecision=$_.ownerDecision; breakingChange=$true; waiverRequired=$true}})
$contract=[pscustomobject]@{schema='codex.powerbi.semanticModelTeamContract.v1'; status=if($contractItems.Count){'BreakingChangesRequireDecision'}else{'ContractStable'}; source=$semanticContract; contractItemCount=$contractItems.Count; items=$contractItems; rules=@('No critical KPI definition change without owner review.','No RLS or sensitivity change without governance review.','Every approved waiver needs an owner and expiry date.')}
$contractPath=Save-Artifact 'semantic-model-team-contract.json' $contract

# 5. Decision memory is portable: user-supplied decision records are normalized and linked to current KPI evidence.
$decisionInput=Read-OptionalJson $DecisionRecordsPath
$decisions=Get-Collection $decisionInput 'decisions'
$memory=@($decisions | ForEach-Object { $record=$_; $metricEvidence=@($trust.metrics | Where-Object name -eq $record.metricName | Select-Object -First 1); [pscustomobject]@{decisionId=if($record.decisionId){$record.decisionId}else{[guid]::NewGuid().ToString()}; decision=$record.decision; metricName=$record.metricName; owner=$record.owner; decisionAt=$record.decisionAt; assumptions=$record.assumptions; evidence=[pscustomobject]@{currentTrustScore=if($metricEvidence){$metricEvidence.trustScore}else{$null}; source='Local decision record plus KPI trust'}; outcomeStatus=if($record.outcomeStatus){$record.outcomeStatus}else{'PendingReview'}; reviewDue=if($record.reviewDue){$record.reviewDue}else{$null}}})
$decisionMemory=[pscustomobject]@{schema='codex.powerbi.decisionMemory.v1'; evidenceMaturity=if($decisions.Count){'LocalDecisionRecords'}else{'EmptyTemplate'}; recordCount=$memory.Count; records=$memory; requiredFields=@('decision','metricName','owner','assumptions','decisionAt','reviewDue','outcomeStatus'); nextAction='Store an approved local decision record and rerun after the decision outcome is known.'}
$memoryPath=Save-Artifact 'decision-memory.json' $decisionMemory

# 6. Exception workflow turns evidence into a human-approved remediation queue.
$exceptions=@($trust.metrics | Where-Object trustScore -lt 70 | ForEach-Object {[pscustomobject]@{exceptionId=('kpi-'+$_.name.Replace(' ','-').ToLowerInvariant());metricName=$_.name;severity=if($_.trustScore -lt 60){'High'}else{'Medium'};detectedBy='KPI trust';proposedAction='Validate definition, freshness, tests, and owner sign-off.'; approvalRequired=$true; status='AwaitingOwnerApproval'; effectivenessCheck='Rerun KPI trust and attach evidence after remediation.'}})
$exceptionWorkflow=[pscustomobject]@{schema='codex.powerbi.exceptionApprovalWorkflow.v1'; status=if($exceptions.Count){'OwnerApprovalRequired'}else{'NoCurrentExceptions'}; exceptionCount=$exceptions.Count; exceptions=$exceptions; stages=@('Detect','Prioritize','Propose','Owner approval','Execute outside plugin','Verify effectiveness'); safety='This workflow never changes a model, Fabric workspace, or data source.'}
$exceptionPath=Save-Artifact 'exception-approval-workflow.json' $exceptionWorkflow

# 7. Portfolio input is an explicit local export, making workspace benchmarks comparable and attributable.
$portfolioInput=Read-OptionalJson $PortfolioPath
$workspaces=Get-Collection $portfolioInput 'workspaces'
$benchmark=@($workspaces | ForEach-Object {[pscustomobject]@{workspaceName=$_.workspaceName; trustScore=$_.trustScore; capacityCu=$_.capacityCu; freshnessStatus=$_.freshnessStatus; securityRisk=$_.securityRisk; testCoverage=$_.testCoverage; rank=0; action=if($_.securityRisk -eq 'High'){'Governance review first'}elseif($_.trustScore -lt 70){'KPI trust remediation'}else{'Monitor'}}})
$ranked=@($benchmark | Sort-Object @{Expression='securityRisk';Descending=$true},@{Expression='trustScore';Descending=$false}); for($index=0;$index -lt $ranked.Count;$index++){$ranked[$index].rank=$index+1}
$portfolio=[pscustomobject]@{schema='codex.powerbi.workspacePortfolioBenchmark.v1'; evidenceMaturity=if($workspaces.Count){'ImportedWorkspaceMetrics'}else{'InputRequired'}; workspaceCount=$ranked.Count; benchmark=$ranked; dimensions=@('trust','CU cost','freshness','security','test coverage'); nextAction='Export one normalized local row per workspace to rank portfolio remediation.'}
$portfolioPathOut=Save-Artifact 'workspace-portfolio-benchmark.json' $portfolio

# 8. Screenshot comparison is deterministic file evidence; visual interpretation is explicitly a follow-up.
$baselineShot=if($BaselineScreenshotPath -and (Test-Path -LiteralPath $BaselineScreenshotPath)){Get-Item -LiteralPath $BaselineScreenshotPath}; $candidateShot=if($CandidateScreenshotPath -and (Test-Path -LiteralPath $CandidateScreenshotPath)){Get-Item -LiteralPath $CandidateScreenshotPath}
$visualStatus=if(-not $baselineShot -or -not $candidateShot){'NeedsScreenshotPair'}elseif((Get-FileHash $baselineShot.FullName -Algorithm SHA256).Hash -eq (Get-FileHash $candidateShot.FullName -Algorithm SHA256).Hash){'NoBinaryDifference'}else{'VisualReviewRequired'}
$visual=[pscustomobject]@{schema='codex.powerbi.visualRegressionEvidence.v1'; status=$visualStatus; baseline=if($baselineShot){[pscustomobject]@{path=$baselineShot.FullName;bytes=$baselineShot.Length;sha256=(Get-FileHash $baselineShot.FullName -Algorithm SHA256).Hash}}else{$null}; candidate=if($candidateShot){[pscustomobject]@{path=$candidateShot.FullName;bytes=$candidateShot.Length;sha256=(Get-FileHash $candidateShot.FullName -Algorithm SHA256).Hash}}else{$null}; checks=@('first-viewport KPI visibility','filter state','empty visuals','text clipping','contrast and accessibility'); nextAction='Attach a screenshot pair and perform a vision-capable review before approving a UI change.'}
$visualPath=Save-Artifact 'visual-regression-evidence.json' $visual

$result=[pscustomobject]@{schema='codex.powerbi.decisionIntelligencePack.v1'; generated=(Get-Date).ToString('s'); root=(Resolve-Path -LiteralPath $Path).Path; outputDirectory=$out; artifactCount=8; artifacts=[pscustomobject]@{copilotReliability=$copilotPath;kpiChangeExplanation=$changePath;businessImpactSimulation=$simulationPath;semanticModelTeamContract=$contractPath;decisionMemory=$memoryPath;exceptionApprovalWorkflow=$exceptionPath;workspacePortfolioBenchmark=$portfolioPathOut;visualRegressionEvidence=$visualPath}}
Save-Artifact 'summary.json' $result | Out-Null
if($Json){$result|ConvertTo-Json -Depth 14}else{$result}
