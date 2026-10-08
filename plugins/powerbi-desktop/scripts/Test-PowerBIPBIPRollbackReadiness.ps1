param(
    [Parameter(Mandatory=$true)][string]$PbipPath,
    [string]$DraftManifest,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PbipPath)
$exists = Test-Path -LiteralPath $root
$files = if ($exists) { @(Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue) } else { @() }
$dirs = if ($exists) { @(Get-ChildItem -LiteralPath $root -Recurse -Directory -ErrorAction SilentlyContinue) } else { @() }

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    try {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    catch {
        return $TargetPath.Substring($BasePath.Length).TrimStart('\', '/')
    }
}

function New-RollbackCheck {
    param([string]$Id, [string]$Name, [string]$Status, [string]$Detail)
    [pscustomobject]@{
        id = $Id
        name = $Name
        status = $Status
        detail = $Detail
    }
}

$pbipFiles = @($files | Where-Object { $_.Extension -eq '.pbip' })
$semanticDirs = @($dirs | Where-Object { $_.Name -like '*.SemanticModel' -or $_.Name -eq 'SemanticModel' })
$reportDirs = @($dirs | Where-Object { $_.Name -like '*.Report' -or $_.Name -eq 'Report' })
$tmdlFiles = @($files | Where-Object { $_.Extension -eq '.tmdl' })
$backupFiles = @($files | Where-Object { $_.Name -match '\.bak($|\.)|backup|rollback' })
$manifestCandidates = New-Object System.Collections.Generic.List[string]

if ($DraftManifest) {
    $manifestCandidates.Add($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($DraftManifest))
}
else {
    foreach ($candidate in @(
        (Join-Path $root 'SemanticModel/drafts/draft-manifest.json'),
        (Join-Path $root 'draft-manifest.json'),
        (Join-Path $root 'pbip-draft-manifest.json')
    )) {
        $manifestCandidates.Add($candidate)
    }
}

$manifestPath = @($manifestCandidates.ToArray() | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)
$manifestArtifacts = @()
$manifestStatus = 'Warn'
$manifestDetail = 'No draft manifest found. Rehearsal can still inspect PBIP structure, but artifact-specific rollback is limited.'
if ($manifestPath) {
    try {
        $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
        $manifestArtifacts = if ($manifest.PSObject.Properties.Name -contains 'artifacts') { @($manifest.artifacts) } else { @() }
        $manifestStatus = if ($manifestArtifacts.Count -gt 0) { 'Pass' } else { 'Warn' }
        $manifestDetail = ('Loaded draft manifest with {0} artifacts.' -f $manifestArtifacts.Count)
    }
    catch {
        $manifestStatus = 'Blocked'
        $manifestDetail = ('Draft manifest could not be parsed: {0}' -f $_.Exception.Message)
    }
}

$checks = @(
    New-RollbackCheck -Id 'pbip.path' -Name 'PBIP path exists' -Status $(if ($exists) { 'Pass' } else { 'Blocked' }) -Detail 'Rollback rehearsal requires an existing PBIP project path.'
    New-RollbackCheck -Id 'pbip.entrypoint' -Name 'PBIP entry point' -Status $(if ($pbipFiles.Count -gt 0) { 'Pass' } else { 'Blocked' }) -Detail 'A .pbip file should be present so Desktop can reopen the project after rollback.'
    New-RollbackCheck -Id 'pbip.semanticModel' -Name 'Semantic model folder' -Status $(if ($semanticDirs.Count -gt 0) { 'Pass' } else { 'Warn' }) -Detail 'A SemanticModel folder is expected for model artifact rollback checks.'
    New-RollbackCheck -Id 'pbip.report' -Name 'Report folder' -Status $(if ($reportDirs.Count -gt 0) { 'Pass' } else { 'Warn' }) -Detail 'A Report folder improves visual/page rollback rehearsal coverage.'
    New-RollbackCheck -Id 'pbip.tmdl' -Name 'TMDL/model artifacts' -Status $(if ($tmdlFiles.Count -gt 0) { 'Pass' } else { 'Warn' }) -Detail 'TMDL files make model rollback review explicit and source-reviewable.'
    New-RollbackCheck -Id 'draft.manifest' -Name 'Apply draft manifest' -Status $manifestStatus -Detail $manifestDetail
    New-RollbackCheck -Id 'backup.hints' -Name 'Backup hints' -Status $(if ($backupFiles.Count -gt 0) { 'Pass' } else { 'Warn' }) -Detail 'Backup files are optional, but their presence improves restore confidence.'
)

$blockedCount = @($checks | Where-Object { $_.status -eq 'Blocked' }).Count
$warnCount = @($checks | Where-Object { $_.status -eq 'Warn' }).Count
$status = if ($blockedCount -gt 0) { 'Blocked' } elseif ($warnCount -gt 0) { 'Warn' } else { 'Ready' }

$artifactPlans = foreach ($artifact in $manifestArtifacts) {
    $artifactPath = if ($artifact.path) { [string]$artifact.path } elseif ($artifact.targetPath) { [string]$artifact.targetPath } else { $null }
    $relative = if ($artifactPath -and [System.IO.Path]::IsPathRooted($artifactPath) -and $exists) { Get-RelativePath -BasePath $root -TargetPath $artifactPath } else { $artifactPath }
    [pscustomobject]@{
        objectName = $artifact.objectName
        objectType = $artifact.objectType
        path = $relative
        applied = $artifact.applied
        rollbackAction = 'Review generated draft artifact, remove or restore from backup in source control, then reopen PBIP in Desktop.'
    }
}

$rehearsalPlan = @(
    'Confirm working tree or source-control snapshot before any manual restore.',
    'Review PBIP entry point, SemanticModel, Report, and TMDL artifacts without copying or deleting files.',
    'Map each apply-draft manifest artifact to the file that would be removed or restored during rollback.',
    'Open the PBIP in Power BI Desktop after rehearsal and refresh metadata.',
    'Run semantic tests, RLS leakage drafts, and release gate checks before publish.'
)

$result = [pscustomobject]@{
    schema = 'codex.powerbi.pbipRollbackReadiness.v1'
    pbipPath = $root
    generated = (Get-Date).ToString('s')
    status = $status
    checkCount = @($checks).Count
    blockedCount = $blockedCount
    warnCount = $warnCount
    pbipFileCount = $pbipFiles.Count
    semanticModelDirectoryCount = $semanticDirs.Count
    reportDirectoryCount = $reportDirs.Count
    tmdlFileCount = $tmdlFiles.Count
    backupHintCount = $backupFiles.Count
    draftManifest = $manifestPath
    draftArtifactCount = @($manifestArtifacts).Count
    rollbackChecks = @($checks)
    rehearsalPlan = @($rehearsalPlan)
    draftArtifactRollbackPlan = @($artifactPlans)
    destructiveActionsPerformed = $false
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI PBIP Rollback Readiness')
$lines.Add('')
$lines.Add(('Status: **{0}**' -f $result.status))
$lines.Add(('PBIP path: `{0}`' -f $result.pbipPath))
$lines.Add(('Draft artifacts: {0}' -f $result.draftArtifactCount))
$lines.Add(('Destructive actions performed: {0}' -f $result.destructiveActionsPerformed))
$lines.Add('')
$lines.Add('## Rollback Checks')
$lines.Add('')
foreach ($check in $result.rollbackChecks) {
    $lines.Add(('- [{0}] {1}: {2}' -f $check.status, $check.name, $check.detail))
}
$lines.Add('')
$lines.Add('## Rehearsal Plan')
$lines.Add('')
foreach ($step in $result.rehearsalPlan) {
    $lines.Add(('- {0}' -f $step))
}
if (@($result.draftArtifactRollbackPlan).Count -gt 0) {
    $lines.Add('')
    $lines.Add('## Draft Artifact Rollback Plan')
    $lines.Add('')
    foreach ($artifact in $result.draftArtifactRollbackPlan) {
        $lines.Add(('- {0} ({1}): {2}' -f $artifact.objectName, $artifact.objectType, $artifact.rollbackAction))
    }
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
