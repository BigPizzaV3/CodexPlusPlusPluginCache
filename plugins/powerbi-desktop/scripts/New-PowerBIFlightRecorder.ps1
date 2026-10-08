param([string]$Path = ".", [string]$HistoryPath = "powerbi-flight-recorder.json", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trust = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustScore.ps1') -Path $Path -Json | ConvertFrom-Json
$gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -Json | ConvertFrom-Json
$record = [pscustomobject]@{ generated = (Get-Date).ToString('s'); root = $trust.root; overallTrustScore = $trust.overallTrustScore; releaseDecision = $gate.decision; metricCount = $trust.metricCount }
$history = @()
if (Test-Path -LiteralPath $HistoryPath) { $history = @(Get-Content -Raw -LiteralPath $HistoryPath | ConvertFrom-Json) }
$history = @($history + $record)
$trend = if ($history.Count -ge 2) { $history[-1].overallTrustScore - $history[-2].overallTrustScore } else { 0 }
$result = [pscustomobject]@{ schema = 'codex.powerbi.flightRecorder.v1'; historyPath = $HistoryPath; latest = $record; trend = $trend; historyCount = $history.Count; history = $history }
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value (($result | ConvertTo-Json -Depth 8)) -Encoding UTF8 }
if ($Json) { $result | ConvertTo-Json -Depth 8; return }
$result

