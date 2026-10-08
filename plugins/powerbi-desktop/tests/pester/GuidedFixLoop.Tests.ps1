$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'
$samplePath = Join-Path $pluginRoot 'examples/sample-model'

Describe 'Power BI guided fix loop' {
    It 'turns scanner and model findings into plan-only prioritized actions' {
        $plan = & (Join-Path $scriptsPath 'New-PowerBIGuidedFixPlan.ps1') -Path $samplePath -Json | ConvertFrom-Json
        $plan.schema | Should Be 'codex.powerbi.guidedFixPlan.v1'
        $plan.mode | Should Be 'PlanOnly'
        $plan.mutatingFixesApplied | Should Be $false
        $plan.fixCount | Should BeGreaterThan 0
        @($plan.fixes | Where-Object { $_.priority -eq 'P0' }).Count | Should BeGreaterThan 0
        @($plan.fixes | Where-Object { $_.nextScript -and $_.releaseGate -and $_.requiresApplyConfirmation }).Count | Should Be $plan.fixCount
    }

    It 'runs the fix-until-green loop as a non-mutating dry run by default' {
        $loop = & (Join-Path $scriptsPath 'Invoke-PowerBIFixUntilGreenLoop.ps1') -Path $samplePath -MaxIterations 2 -Json | ConvertFrom-Json
        $loop.schema | Should Be 'codex.powerbi.fixUntilGreenLoop.v1'
        $loop.mode | Should Be 'PlanOnly'
        $loop.applied | Should Be $false
        $loop.iterationCount | Should Be 1
        $loop.iterations[0].plannedFixCount | Should BeGreaterThan 0
        $loop.iterations[0].appliedFixCount | Should Be 0
    }
}
