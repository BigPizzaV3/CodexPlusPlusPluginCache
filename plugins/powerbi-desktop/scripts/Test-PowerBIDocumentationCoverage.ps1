param(
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Split-Path -Parent $scriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $pluginRoot)

function Resolve-ExistingFiles {
    param([string[]]$Paths)

    foreach ($path in $Paths) {
        if (Test-Path -LiteralPath $path) {
            Get-Item -LiteralPath $path
        }
    }
}

function Add-Finding {
    param(
        [System.Collections.Generic.List[object]]$Findings,
        [string]$Id,
        [string]$Severity,
        [string]$Message,
        [string]$Evidence
    )

    $Findings.Add([pscustomobject]@{
        id = $Id
        severity = $Severity
        message = $Message
        evidence = $Evidence
    }) | Out-Null
}

$findings = [System.Collections.Generic.List[object]]::new()

$documentationFiles = @()
$documentationFiles += Resolve-ExistingFiles @(
    (Join-Path $repoRoot 'README.md'),
    (Join-Path $pluginRoot '.codex-plugin/plugin.json')
)
$documentationFiles += Get-ChildItem -LiteralPath (Join-Path $repoRoot 'docs') -Recurse -File -Filter '*.md' -ErrorAction SilentlyContinue
$documentationFiles += Get-ChildItem -LiteralPath (Join-Path $pluginRoot 'skills') -Recurse -File -Filter 'SKILL.md' -ErrorAction SilentlyContinue

$documentationText = ($documentationFiles | ForEach-Object {
    Get-Content -LiteralPath $_.FullName -Raw
}) -join [Environment]::NewLine

$scriptFiles = Get-ChildItem -LiteralPath $scriptRoot -File -Filter '*.ps1' | Sort-Object Name
foreach ($script in $scriptFiles) {
    if ($documentationText -notmatch [regex]::Escape($script.Name)) {
        Add-Finding -Findings $findings -Id 'script.documentation.missing' -Severity 'Error' -Message 'Script is not mentioned in README, docs, SKILL, or plugin metadata.' -Evidence $script.Name
    }
}

$forbiddenClaims = @('12-USP', 'semanticTestRunner.v1')
foreach ($claim in $forbiddenClaims) {
    if ($documentationText -match [regex]::Escape($claim)) {
        Add-Finding -Findings $findings -Id 'claim.forbidden' -Severity 'Error' -Message 'Forbidden stale claim found in documentation or plugin metadata.' -Evidence $claim
    }
}

if ($documentationText -notmatch [regex]::Escape('New-PowerBILiveExecutiveNarrative.ps1')) {
    Add-Finding -Findings $findings -Id 'live.executive.narrative.missing' -Severity 'Error' -Message 'Live executive narrative script must be explicitly documented.' -Evidence 'New-PowerBILiveExecutiveNarrative.ps1'
}

$pluginJsonPath = Join-Path $pluginRoot '.codex-plugin/plugin.json'
try {
    Get-Content -LiteralPath $pluginJsonPath -Raw | ConvertFrom-Json | Out-Null
}
catch {
    Add-Finding -Findings $findings -Id 'plugin.json.invalid' -Severity 'Error' -Message 'plugin.json must parse as JSON.' -Evidence $_.Exception.Message
}

$errors = @($findings | Where-Object { $_.severity -eq 'Error' })
$result = [pscustomobject]@{
    schema = 'codex.powerbi.documentationCoverage.v1'
    checkedScriptCount = @($scriptFiles).Count
    checkedDocumentationFileCount = @($documentationFiles).Count
    status = if ($errors.Count -gt 0) { 'Failed' } else { 'Passed' }
    errorCount = $errors.Count
    findings = @($findings)
}

if ($Json) {
    $result | ConvertTo-Json -Depth 6
}
else {
    'Power BI documentation coverage: {0}' -f $result.status
    'Scripts checked: {0}' -f $result.checkedScriptCount
    'Documentation files checked: {0}' -f $result.checkedDocumentationFileCount
    foreach ($finding in $findings) {
        '[{0}] {1}: {2} ({3})' -f $finding.severity, $finding.id, $finding.message, $finding.evidence
    }
}

if ($errors.Count -gt 0) {
    throw 'Power BI documentation coverage failed.'
}
