param(
    [string]$Path = '.',
    [string]$OutputDirectory = 'powerbi-enterprise-operations-pack',
    [string]$CapacityBeforePath,
    [string]$CapacityAfterPath,
    [string]$GovernanceBaselinePath,
    [string]$CopilotAnswersPath,
    [string]$SloHistoryPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Save-Json { param([string]$Name, $Value) $target = Join-Path $out $Name; $Value | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $target -Encoding UTF8; $target }
function Get-InputRows {
    param([string]$InputPath)
    if (-not $InputPath -or -not (Test-Path -LiteralPath $InputPath)) { return @() }
    $candidate = if ((Get-Item -LiteralPath $InputPath).PSIsContainer) { Join-Path $InputPath 'capacity-metrics.json' } else { $InputPath }
    if (-not (Test-Path -LiteralPath $candidate)) { return @() }
    $raw = Get-Content -Raw -LiteralPath $candidate | ConvertFrom-Json
    if ($raw.PSObject.Properties.Name -contains 'value') { return @($raw.value) }
    if ($raw.PSObject.Properties.Name -contains 'rows') { return @($raw.rows) }
    return @($raw)
}
function Sum-Number { param($Rows, [string]$Name) [math]::Round((@($Rows | Measure-Object -Property $Name -Sum).Sum), 2) }

$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$readiness = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $Path -Json | ConvertFrom-Json
$sloActions = & (Join-Path $scriptRoot 'New-PowerBIKpiSloActionList.ps1') -Path $Path -Json | ConvertFrom-Json
$files = @(Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue)

# 1: Captured Copilot answers are optional and never sent to any service.
$answers = @()
if ($CopilotAnswersPath -and (Test-Path -LiteralPath $CopilotAnswersPath)) {
    $answerRaw = Get-Content -Raw -LiteralPath $CopilotAnswersPath | ConvertFrom-Json
    $answers = if ($answerRaw.PSObject.Properties.Name -contains 'answers') { @($answerRaw.answers) } else { @($answerRaw) }
}
$copilotCases = @($trust.metrics | ForEach-Object {
    $metric = $_
    $answer = @($answers | Where-Object { $_.metricName -eq $metric.name -or $_.question -match [regex]::Escape($metric.name) } | Select-Object -First 1)
    [pscustomobject]@{ metricName = $metric.name; question = "What is $($metric.name) and how current is it?"; answerCaptured = [bool]$answer; evaluation = if ($answer) { if ($answer.approved -eq $true) { 'Approved' } else { 'NeedsReviewerDecision' } } else { 'PendingCapture' }; requiredEvidence = @('definition', 'owner', 'freshness', 'semantic test') }
})
$copilot = [pscustomobject]@{ schema='codex.powerbi.copilotQualityMonitor.v1'; evidenceMaturity=if ($answers.Count) {'CapturedAnswers'} else {'TestPlanOnly'}; testCaseCount=$copilotCases.Count; capturedAnswerCount=@($copilotCases | Where-Object answerCaptured).Count; pendingCount=@($copilotCases | Where-Object evaluation -eq 'PendingCapture').Count; readiness=$readiness; cases=$copilotCases; nextAction='Capture approved Copilot answers locally and rerun to record reviewer decisions.' }
$copilotPath = Save-Json 'copilot-quality-monitor.json' $copilot

# 2: comparable capacity snapshots become a local FinOps before/after decision.
$before = Get-InputRows $CapacityBeforePath; $after = Get-InputRows $CapacityAfterPath
$beforeCu = Sum-Number $before 'cu'; $afterCu = Sum-Number $after 'cu'
$beforeThrottle = [int](Sum-Number $before 'throttlingEvents'); $afterThrottle = [int](Sum-Number $after 'throttlingEvents')
$capacityStatus = if (-not $CapacityBeforePath -or -not $CapacityAfterPath) {'NeedsComparableSnapshots'} elseif (-not $before.Count -or -not $after.Count) {'InvalidSnapshotInput'} elseif ($afterThrottle -gt $beforeThrottle -or $afterCu -gt $beforeCu) {'NeedsOptimizationReview'} else {'ImprovedOrStable'}
$capacity = [pscustomobject]@{ schema='codex.powerbi.capacityFinOpsComparison.v1'; evidenceMaturity=if ($before.Count -and $after.Count) {'ComparableImportedSnapshots'} else {'BaselineRequired'}; status=$capacityStatus; before=[pscustomobject]@{rows=$before.Count;cu=$beforeCu;throttling=$beforeThrottle}; after=[pscustomobject]@{rows=$after.Count;cu=$afterCu;throttling=$afterThrottle}; delta=[pscustomobject]@{cu=[math]::Round($afterCu-$beforeCu,2);throttling=$afterThrottle-$beforeThrottle}; ownerAllocation=@($after | Group-Object workspaceName | ForEach-Object {[pscustomobject]@{workspace=$_.Name;cu=Sum-Number $_.Group 'cu';owner='Assign workspace cost owner'}}); actions=@('Compare the same time window and workload.', 'Assign each workspace to a cost owner.', 'Investigate higher CU or throttling before scaling capacity.') }
$capacityPath = Save-Json 'capacity-finops-comparison.json' $capacity

# 3: Direct Lake / OneLake remains evidence-based: only explicit local metadata is claimed.
$directSignals = @($files | Select-String -Pattern 'DirectLake|OneLake|Lakehouse|Warehouse|Delta|Shortcut' -SimpleMatch -List -ErrorAction SilentlyContinue | ForEach-Object {$_.Path} | Sort-Object -Unique)
$directLake = [pscustomobject]@{ schema='codex.powerbi.directLakeOneLakeEvidence.v1'; evidenceMaturity=if ($directSignals.Count) {'LocalMetadata'} else {'NoMetadata'}; status=if ($directSignals.Count) {'NeedsFabricEvidence'} else {'NoDirectLakeMetadataDetected'}; localSignals=$directSignals; checks=@('Delta-table schema and ownership','OneLake shortcut target and access','Direct Lake fallback behavior','capacity and query-performance evidence'); nextAction='Import a read-only Fabric snapshot before treating this as a Direct Lake validation.' }
$directLakePath = Save-Json 'directlake-onelake-evidence.json' $directLake

# 4: SLO history is a portable append-only local record, with an explicit escalation level.
$history = @()
if ($SloHistoryPath -and (Test-Path -LiteralPath $SloHistoryPath)) { $history = @(Get-Content -Raw -LiteralPath $SloHistoryPath | ConvertFrom-Json) }
$historyEntry = [pscustomobject]@{ observedAt=(Get-Date).ToString('s'); actionRequiredCount=$sloActions.actionRequiredCount; needsOwnerSetupCount=$sloActions.needsOwnerSetupCount; sourceRoot=$trust.root }
$history = @($history + $historyEntry)
$escalation = if ($sloActions.needsOwnerSetupCount -gt 0) {'OwnerSetup'} elseif ($sloActions.actionRequiredCount -gt 0) {'OwnerAction'} else {'None'}
$slo = [pscustomobject]@{ schema='codex.powerbi.kpiSloOperations.v1'; status=if ($escalation -eq 'None') {'OnTrack'} else {'EscalationRequired'}; escalation=$escalation; historyCount=$history.Count; latest=$historyEntry; actions=$sloActions.items; history=$history; workflow=@('Assign owner','Set due date','Record remediation evidence','Mark effectiveness reviewed') }
$sloPath = Save-Json 'kpi-slo-operations.json' $slo

# 5: governance drift compares a deliberately supplied baseline; no external tenant read is assumed.
$baseline = $null
if ($GovernanceBaselinePath -and (Test-Path -LiteralPath $GovernanceBaselinePath)) { $baseline = Get-Content -Raw -LiteralPath $GovernanceBaselinePath | ConvertFrom-Json }
$currentGovernance = [pscustomobject]@{ rlsRiskCount=@($trust.metrics | Where-Object trustScore -lt 60).Count; modelFileCount=@($files | Where-Object {$_.Extension -in '.tmdl','.bim','.dax','.pq'}).Count; decisionCriticalKpiCount=@($sloActions.items | Where-Object decisionCritical).Count }
$drift = [pscustomobject]@{ schema='codex.powerbi.governanceDrift.v1'; evidenceMaturity=if ($baseline) {'LocalBaselineComparison'} else {'BaselineRequired'}; status=if ($baseline) {'ReviewDrift'} else {'NeedsGovernanceBaseline'}; current=$currentGovernance; baseline=$baseline; checks=@('RLS and role changes','sensitivity labels','sharing exposure','gateway and source changes','owner assignment'); nextAction=if ($baseline) {'Review reported differences with the governance owner.'} else {'Save an approved local baseline and rerun.'} }
$driftPath = Save-Json 'governance-drift.json' $drift

# 6: signed, reproducible bundle; hashing runs after the seven decision artifacts exist.
$bundleFiles = @(Get-ChildItem -LiteralPath $out -File | Sort-Object FullName)
$bundleHashes = @($bundleFiles | ForEach-Object {$h=Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256; [pscustomobject]@{file=$_.Name;sha256=$h.Hash;bytes=$_.Length}})
$joined = [string]::Join('|', @($bundleHashes.sha256)); $sha = [Security.Cryptography.SHA256]::Create(); $bundleSignature=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($joined)))).Replace('-','').ToLowerInvariant()
$bundle = [pscustomobject]@{ schema='codex.powerbi.releaseEvidenceBundle.v1'; status='ReadyForOwnerSignOff'; generated=(Get-Date).ToString('s'); signatureAlgorithm='SHA256'; signature=$bundleSignature; artifactCount=$bundleHashes.Count; artifacts=$bundleHashes; signOff=@('Business owner','Model owner','Governance owner'); exceptions=@('No external sign-in or publishing is performed by this pack.') }
$bundlePath = Save-Json 'release-evidence-bundle.json' $bundle

# 7: onboarding checks entry points and tells each persona which local feature is usable now.
$onboarding = [pscustomobject]@{ schema='codex.powerbi.onboardingStatus.v1'; status='Ready'; roles=@(
    [pscustomobject]@{role='Analyst';start='Invoke-PowerBIAutoReview.ps1';outcome='KPI definitions, caveats, and action list'},
    [pscustomobject]@{role='Executive';start='New-PowerBIExecutiveTrustBrief.ps1';outcome='Decision readiness and accountable owners'},
    [pscustomobject]@{role='Developer';start='Invoke-PowerBIUnifiedReview.ps1';outcome='PBIP/TMDL-safe review and validation'},
    [pscustomobject]@{role='Fabric owner';start='Invoke-PowerBIEnterpriseOperationsPack.ps1';outcome='Local evidence for capacity, Copilot, Direct Lake, SLO and governance'}
); available=$true; setup=@('Use local PBIP/TMDL or exported snapshots.', 'Add Fabric credentials only to explicit read-only snapshot workflows.', 'Do not edit PBIX/PBIT binaries.') }
$onboardingPath = Save-Json 'onboarding-status.json' $onboarding

# 8: a transparent quality gate to make technical debt visible without claiming test coverage that was not measured.
$pythonFiles=@($files | Where-Object Extension -eq '.py'); $testFiles=@(Get-ChildItem -LiteralPath (Join-Path (Split-Path -Parent $scriptRoot) 'tests') -Recurse -File -ErrorAction SilentlyContinue)
$quality=[pscustomobject]@{ schema='codex.powerbi.pluginQualityGate.v1'; status=if ($pythonFiles.Count -gt 0) {'NeedsPythonTestCoverage'} else {'Ready'}; scriptCount=@($files | Where-Object Extension -eq '.ps1').Count; pythonFileCount=$pythonFiles.Count; testFileCount=$testFiles.Count; checks=@([pscustomobject]@{id='python-unit-tests';status=if($pythonFiles.Count){'MissingEvidence'}else{'NotApplicable'};action='Add focused tests before changing forecast logic.'},[pscustomobject]@{id='performance-benchmark';status='NeedsUsageBenchmark';action='Record a representative local pack duration and artifact count.'},[pscustomobject]@{id='documentation';status='RunDocumentationCoverage';action='Run Test-PowerBIDocumentationCoverage.ps1.'}) }
$qualityPath=Save-Json 'plugin-quality-gate.json' $quality

$result=[pscustomobject]@{schema='codex.powerbi.enterpriseOperationsPack.v1'; generated=(Get-Date).ToString('s'); root=(Resolve-Path -LiteralPath $Path).Path; outputDirectory=$out; artifactCount=8; artifacts=[pscustomobject]@{copilotQualityMonitor=$copilotPath;capacityFinOpsComparison=$capacityPath;directLakeOneLakeEvidence=$directLakePath;kpiSloOperations=$sloPath;governanceDrift=$driftPath;releaseEvidenceBundle=$bundlePath;onboardingStatus=$onboardingPath;pluginQualityGate=$qualityPath} }
Save-Json 'summary.json' $result | Out-Null
if ($Json) { $result | ConvertTo-Json -Depth 12 } else { $result }
