param([string]$Path = ".", [string]$OutputDirectory = "powerbi-autonomous-qa-lab", [switch]$Json, [switch]$FailOnPending)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Path).Path
$out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $out | Out-Null
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $source -Json | ConvertFrom-Json
$semantic = & (Join-Path $scriptRoot 'Invoke-PowerBISemanticTestRunner.ps1') -Path $source -FailOnPending:$FailOnPending -Json | ConvertFrom-Json
$visual = & (Join-Path $scriptRoot 'Test-PowerBIReportRenderReadiness.ps1') -Path $source -Json | ConvertFrom-Json
$behavior = & (Join-Path $scriptRoot 'Compare-PowerBIMeasureBehavior.ps1') -Path $source -Json | ConvertFrom-Json
$questions = @($catalog.metrics | ForEach-Object { [pscustomobject]@{ measure=$_.name; question=('Does {0} reconcile for the executive filter context?' -f $_.name); expectedEvidence='Semantic expectation, DAX result, and owner sign-off.' } })
$expectations = [pscustomobject]@{ schema='codex.powerbi.generatedQaExpectations.v1'; expectations=@($semantic.tests | ForEach-Object { [pscustomobject]@{ measure=$_.measure; expected=$_.expected; tolerance=$_.tolerance; filters=$_.filterContext; result=$_.result; daxQuery=$_.daxQuery } }) }
$visual | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'visual-readiness.json') -Encoding UTF8
$questions | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'generated-questions.json') -Encoding UTF8
$expectations | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'semantic-expectations.json') -Encoding UTF8
@('# Regression Risk','', "Behavior comparison status: $($behavior.status)", "Semantic status: $($semantic.status)", "Visual publish readiness: $($visual.readyForAutomatedPublish)") | Set-Content -LiteralPath (Join-Path $out 'regression-risk.md') -Encoding UTF8
$summary = [pscustomobject]@{ schema='codex.powerbi.autonomousQALab.v1'; generated=(Get-Date).ToString('s'); source=$source; outputDirectory=$out; qaQuestionCount=@($questions).Count; semanticCheckCount=$semantic.testCount; pendingCount=$semantic.pendingCount; failedCount=$semantic.failedCount; visualReadinessStatus=if($visual.readyForAutomatedPublish){'Ready'}else{'ManualValidationRequired'}; releaseRisk=if($semantic.failedCount -gt 0 -or ($FailOnPending -and $semantic.pendingCount -gt 0)){'High'}elseif($semantic.pendingCount -gt 0){'Medium'}else{'Low'} }
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'summary.json') -Encoding UTF8
if ($Json) { $summary | ConvertTo-Json -Depth 10; return }
$summary
