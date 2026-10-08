param(
    [string]$ActionName = 'Power BI live Desktop action',
    [ValidateSet('ReadOnly','Mutating')]
    [string]$OperationType = 'ReadOnly',
    [string]$Server,
    [int]$Port,
    [switch]$DryRun,
    [switch]$Preview,
    [switch]$Confirm,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$target = & (Join-Path $PSScriptRoot 'Resolve-PowerBILiveTarget.ps1') -Server $Server -Port $Port -Json | ConvertFrom-Json
$mode = if ($DryRun) { 'DryRun' } elseif ($Preview) { 'Preview' } elseif ($Confirm) { 'Confirm' } else { 'DryRun' }
$isMutating = $OperationType -eq 'Mutating'
$allowedToExecute = -not $isMutating -or $mode -eq 'Confirm'

$plan = [pscustomobject]@{
    schema = 'codex.powerbi.liveSafetyPlan.v1'
    generated = (Get-Date).ToString('s')
    actionName = $ActionName
    operationType = $OperationType
    mode = $mode
    dryRun = $mode -eq 'DryRun'
    preview = $mode -eq 'Preview'
    confirmed = $mode -eq 'Confirm'
    allowedToExecute = $allowedToExecute
    targetStatus = $target.status
    target = $target.target
    guardrails = @(
        'No SaveChanges against the live Desktop model.',
        'No publish to Power BI Service.',
        'No credential read, write, prompt, or storage.',
        'Mutating actions require an explicit Confirm mode and should still write a reviewable plan first.'
    )
    requiredWorkflow = @(
        'DryRun: produce a machine-readable plan only.',
        'Preview: resolve target and describe intended changes without mutation.',
        'Confirm: allowed only for explicit mutating workflows that have their own implementation guard.'
    )
}

if ($Json) {
    $plan | ConvertTo-Json -Depth 8
    return
}

"Action: $($plan.actionName)"
"Mode: $($plan.mode)"
"Operation: $($plan.operationType)"
"Allowed to execute: $($plan.allowedToExecute)"
"Target status: $($plan.targetStatus)"
$plan.guardrails | ForEach-Object { "- $_" }
