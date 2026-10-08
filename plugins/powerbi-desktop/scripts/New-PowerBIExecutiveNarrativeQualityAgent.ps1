param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Path).Path
$narrative = & (Join-Path $scriptRoot 'New-PowerBIExecutiveNarrative.ps1') -Path $source
$critic = & (Join-Path $scriptRoot 'New-PowerBIReportNarrativeCritic.ps1') -Path $source -Json | ConvertFrom-Json
$intent = & (Join-Path $scriptRoot 'New-PowerBIVisualIntentAnalyzer.ps1') -Path $source -Json | ConvertFrom-Json
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $source -Json | ConvertFrom-Json
$findings = New-Object System.Collections.Generic.List[object]
foreach ($finding in @($critic.findings)) { $findings.Add([pscustomobject]@{ category='unsupported_claim'; severity=$finding.severity; message=$finding.message; recommendation=$finding.recommendation }) }
foreach ($finding in @($intent.findings)) { $findings.Add([pscustomobject]@{ category='visual_narrative_mismatch'; severity=$finding.severity; message=$finding.title; recommendation=$finding.recommendation }) }
foreach ($check in @($gate.checks | Where-Object { $_.status -ne 'Pass' })) { $findings.Add([pscustomobject]@{ category='release_gate_conflict'; severity=$check.status; message=$check.name; recommendation=$check.detail }) }
if ($narrative -notmatch '(?i)variance|trend|owner|decision') { $findings.Add([pscustomobject]@{ category='missing_variance_context'; severity='Medium'; message='Narrative may lack variance, trend, owner, or decision context.'; recommendation='Add executive decision context and validation evidence.' }) }
$claimCount = ([regex]::Matches($narrative, '(?m)^[-#]')).Count
$unsupported = @($findings | Where-Object category -in @('unsupported_claim','low_trust_kpi_claim','release_gate_conflict'))
$score = 100 - ([int]@($findings.ToArray()).Count * 12)
if ($score -lt 0) { $score = 0 }
$result = [pscustomobject]@{ schema='codex.powerbi.executiveNarrativeQuality.v1'; generated=(Get-Date).ToString('s'); source=$source; qualityScore=$score; claimCount=$claimCount; unsupportedClaimCount=@($unsupported).Count; findings=@($findings.ToArray()) }
if ($Json) { $text=$result|ConvertTo-Json -Depth 10; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8}; $text; return }
$md=@('# Power BI Executive Narrative Quality Agent','',"Quality score: **$($result.qualityScore)**",'')+@($result.findings|ForEach-Object{"- [$($_.severity)] $($_.category): $($_.message) $($_.recommendation)"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine
if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8}
$content
