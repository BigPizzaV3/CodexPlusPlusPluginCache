param(
    [string]$PluginRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path,
    [switch]$SkipPester
)

$ErrorActionPreference = 'Stop'

$resolvedPluginRoot = (Resolve-Path -LiteralPath $PluginRoot).Path
$scriptsPath = Join-Path $resolvedPluginRoot 'scripts'
$pesterPath = Join-Path $resolvedPluginRoot 'tests/pester'
$results = New-Object System.Collections.Generic.List[object]

function Add-TestSuiteResult {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    $results.Add([pscustomobject]@{
        Name = $Name
        Passed = $Passed
        Detail = $Detail
    })
}

try {
    & (Join-Path $scriptsPath 'Test-PowerBIPlugin.ps1') -PluginRoot $resolvedPluginRoot | Out-Host
    Add-TestSuiteResult -Name 'Smoke' -Passed $true -Detail 'Test-PowerBIPlugin.ps1 passed.'
}
catch {
    Add-TestSuiteResult -Name 'Smoke' -Passed $false -Detail $_.Exception.Message
}

try {
    & (Join-Path $scriptsPath 'Test-PowerBIGoldenBaselines.ps1') -PluginRoot $resolvedPluginRoot | Out-Host
    Add-TestSuiteResult -Name 'Golden baselines' -Passed $true -Detail 'Test-PowerBIGoldenBaselines.ps1 passed.'
}
catch {
    Add-TestSuiteResult -Name 'Golden baselines' -Passed $false -Detail $_.Exception.Message
}

if (-not $SkipPester) {
    try {
        if (-not (Get-Module -ListAvailable -Name Pester)) {
            throw 'Pester is not installed.'
        }
        Invoke-Pester $pesterPath | Out-Host
        Add-TestSuiteResult -Name 'Pester' -Passed $true -Detail $pesterPath
    }
    catch {
        Add-TestSuiteResult -Name 'Pester' -Passed $false -Detail $_.Exception.Message
    }
}

$results | Format-Table Name, Passed, Detail -AutoSize
if (($results | Where-Object { -not $_.Passed }).Count -gt 0) {
    exit 1
}
