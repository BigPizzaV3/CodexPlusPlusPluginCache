param([string]$Path = ".", [string]$PbipPath, [int]$MaxIterations = 3, [string]$OutputPath, [switch]$Apply, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$iterations = New-Object System.Collections.Generic.List[object]
for ($i = 1; $i -le $MaxIterations; $i++) {
    $plan = & (Join-Path $scriptRoot 'New-PowerBIGuidedFixPlan.ps1') -Path $Path -Json | ConvertFrom-Json
    $candidateFix = @($plan.fixes | Select-Object -First 1)
    $fix = $null
    if ($Apply) {
        $fix = & (Join-Path $scriptRoot 'Invoke-PowerBIAutonomousFixAgent.ps1') -Path $Path -PbipPath $PbipPath -MaxFixes 1 -Apply -Json | ConvertFrom-Json
    }
    $golden = & (Join-Path $scriptRoot 'Test-PowerBIGoldenBaselines.ps1') -PluginRoot (Split-Path -Parent $scriptRoot) -Json | ConvertFrom-Json
    $gate = & (Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -Json | ConvertFrom-Json
    $green = ($golden.failedCount -eq 0 -and $gate.decision -ne 'No-Go' -and @($plan.fixes | Where-Object priority -eq 'P0').Count -eq 0)
    $iterations.Add([pscustomobject]@{
        iteration = $i
        mode = if ($Apply) { 'ApplyRequested' } else { 'PlanOnly' }
        plannedFixCount = $plan.fixCount
        applied = if ($fix) { $fix.applied } else { $false }
        appliedFixCount = if ($fix) { $fix.fixCount } else { 0 }
        nextAction = if ($candidateFix.Count -gt 0) { $candidateFix[0] } else { $null }
        goldenFailed = $golden.failedCount
        releaseDecision = $gate.decision
        releaseGates = @($plan.releaseGates)
        green = $green
    })
    if ($green -or -not $Apply -or $plan.fixCount -eq 0) { break }
}
$iterationArray = @($iterations.ToArray())
$finalGreen = if ($iterationArray.Count -gt 0) { $iterationArray[-1].green } else { $false }
$result = [pscustomobject]@{
    schema='codex.powerbi.fixUntilGreenLoop.v1'
    generated=(Get-Date).ToString('s')
    mode=if ($Apply) { 'ApplyRequested' } else { 'PlanOnly' }
    applied=[bool]$Apply
    mutationPolicy=if ($Apply) { 'Apply switch was provided; delegated apply-capable scripts still require target inputs.' } else { 'No mutating fixes were run. Use -Apply plus reviewed target inputs to mutate.' }
    iterationCount=$iterationArray.Count
    finalGreen=$finalGreen
    iterations=$iterationArray
}
if ($Json) { $text=$result|ConvertTo-Json -Depth 8; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8}; $text; return }
$md = @('# Power BI Fix Until Green Loop','',"Mode: $($result.mode)","Applied: $($result.applied)","Final green: $($result.finalGreen)","Mutation policy: $($result.mutationPolicy)",'') + @($result.iterations | ForEach-Object { "- Iteration $($_.iteration): decision=$($_.releaseDecision), goldenFailed=$($_.goldenFailed), plannedFixes=$($_.plannedFixCount), appliedFixes=$($_.appliedFixCount)" })
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8}; $content
