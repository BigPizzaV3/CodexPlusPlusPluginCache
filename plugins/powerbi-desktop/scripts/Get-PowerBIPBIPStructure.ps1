param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Path).Path
$files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue

function Test-Any {
    param([string[]]$Patterns)
    foreach ($pattern in $Patterns) {
        if ($files | Where-Object { $_.FullName -like $pattern }) {
            return $true
        }
    }
    return $false
}

$pbipFiles = @($files | Where-Object { $_.Extension -eq '.pbip' })
$semanticModelDirs = @(Get-ChildItem -LiteralPath $root -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*.SemanticModel' })
$reportDirs = @(Get-ChildItem -LiteralPath $root -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*.Report' })
$tmdlFiles = @($files | Where-Object { $_.Extension -eq '.tmdl' })
$reportJsonFiles = @($files | Where-Object { $_.Name -in @('report.json', 'definition.pbir') })
$modelFiles = @($files | Where-Object { $_.Name -in @('model.bim', 'definition.pbism') })
$platformFiles = @($files | Where-Object { $_.Name -eq '.platform' })
$diagramLayoutFiles = @($files | Where-Object { $_.Name -eq 'diagramLayout.json' })
$pbirFiles = @($files | Where-Object { $_.Name -eq 'definition.pbir' })

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    try {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    catch {
        return $TargetPath.Substring($BasePath.Length).TrimStart('\', '/')
    }
}

function New-StructureCheck {
    param(
        [string]$Id,
        [string]$Name,
        [bool]$Passed,
        [string]$Severity,
        [string]$Detail
    )
    [pscustomobject]@{
        id = $Id
        name = $Name
        status = if ($Passed) { 'Pass' } else { $Severity }
        passed = $Passed
        severity = $Severity
        detail = $Detail
    }
}

$score = 0
if ($pbipFiles.Count -gt 0) { $score += 20 }
if ($semanticModelDirs.Count -gt 0) { $score += 20 }
if ($reportDirs.Count -gt 0) { $score += 15 }
if ($tmdlFiles.Count -gt 0) { $score += 20 }
if ($reportJsonFiles.Count -gt 0) { $score += 10 }
if ($modelFiles.Count -gt 0) { $score += 15 }
if ($platformFiles.Count -gt 0) { $score += 5 }
if ($pbirFiles.Count -gt 0) { $score += 5 }

$score = [Math]::Min($score, 100)
$structureChecks = @(
    New-StructureCheck -Id 'pbip.entrypoint' -Name 'PBIP entry point' -Passed ($pbipFiles.Count -gt 0) -Severity 'Fail' -Detail 'A .pbip file is required as the source-controlled Desktop project entry point.'
    New-StructureCheck -Id 'semantic.folder' -Name 'Semantic model folder' -Passed ($semanticModelDirs.Count -gt 0) -Severity 'Fail' -Detail 'A *.SemanticModel folder is expected for realistic PBIP round-trip validation.'
    New-StructureCheck -Id 'semantic.definition' -Name 'Semantic model definition' -Passed (($tmdlFiles.Count -gt 0) -or ($modelFiles.Count -gt 0)) -Severity 'Fail' -Detail 'TMDL files, model.bim, or definition.pbism should be present for model round-tripping.'
    New-StructureCheck -Id 'report.folder' -Name 'Report folder' -Passed ($reportDirs.Count -gt 0) -Severity 'Warn' -Detail 'A *.Report folder is expected when validating report layout round-tripping.'
    New-StructureCheck -Id 'report.definition' -Name 'Report definition' -Passed ($reportJsonFiles.Count -gt 0) -Severity 'Warn' -Detail 'Report metadata such as definition.pbir or report.json should be present.'
    New-StructureCheck -Id 'platform.metadata' -Name 'Platform metadata' -Passed ($platformFiles.Count -gt 0) -Severity 'Warn' -Detail '.platform files are usually present in complete PBIP artifacts.'
)
$failCount = @($structureChecks | Where-Object { $_.status -eq 'Fail' }).Count
$warnCount = @($structureChecks | Where-Object { $_.status -eq 'Warn' }).Count
$roundtripStatus = if ($failCount -gt 0) { 'Incomplete' } elseif ($warnCount -gt 0) { 'Warning' } else { 'Ready' }
$readiness = if ($score -ge 80 -and $failCount -eq 0) { 'Strong' } elseif ($score -ge 40) { 'Partial' } else { 'Limited' }
$recommendations = New-Object System.Collections.Generic.List[string]
if ($pbipFiles.Count -eq 0) { $recommendations.Add('Create or export a PBIP entry point for source-controlled Desktop round-tripping.') }
if ($semanticModelDirs.Count -eq 0 -and $tmdlFiles.Count -eq 0 -and $modelFiles.Count -eq 0) { $recommendations.Add('Export the semantic model to TMDL or model.bim before requesting structural changes.') }
if ($reportDirs.Count -eq 0 -and $reportJsonFiles.Count -eq 0) { $recommendations.Add('Export report metadata if layout or visual analysis is required.') }
if ($platformFiles.Count -eq 0) { $recommendations.Add('Include .platform metadata from Desktop/Git export to improve PBIP completeness checks.') }
if ($recommendations.Count -eq 0) { $recommendations.Add('Project structure is ready for deeper model and report review.') }

$roundtripPlan = @(
    'Validate PBIP entry point, *.SemanticModel, semantic definition files, and *.Report metadata.',
    'Run the trust release gate and resolve No-Go checks before producing a PBIX candidate.',
    'Compile with pbi-tools when available, otherwise open the PBIP in Power BI Desktop and Save As PBIX.',
    'Reopen the produced PBIX and rerun semantic tests plus live validation before any publishing step.'
)

$result = [pscustomobject]@{
    schema = 'codex.powerbi.pbipStructure.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    readiness = $readiness
    roundtripStatus = $roundtripStatus
    score = $score
    pbipFiles = @($pbipFiles | Select-Object -ExpandProperty FullName)
    pbipRelativeFiles = @($pbipFiles | ForEach-Object { Get-RelativePath -BasePath $root -TargetPath $_.FullName })
    semanticModelDirectories = @($semanticModelDirs | Select-Object -ExpandProperty FullName)
    reportDirectories = @($reportDirs | Select-Object -ExpandProperty FullName)
    tmdlFileCount = $tmdlFiles.Count
    reportMetadataFileCount = $reportJsonFiles.Count
    modelMetadataFileCount = $modelFiles.Count
    platformMetadataFileCount = $platformFiles.Count
    diagramLayoutFileCount = $diagramLayoutFiles.Count
    checks = $structureChecks
    roundtripPlan = $roundtripPlan
    recommendations = @($recommendations)
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 6
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI PBIP Structure')
$lines.Add('')
$lines.Add(('Readiness: **{0}** ({1}/100)' -f $result.readiness, $result.score))
$lines.Add(('Roundtrip status: **{0}**' -f $result.roundtripStatus))
$lines.Add(('PBIP files: {0}' -f @($result.pbipFiles).Count))
$lines.Add(('Semantic model directories: {0}' -f @($result.semanticModelDirectories).Count))
$lines.Add(('Report directories: {0}' -f @($result.reportDirectories).Count))
$lines.Add(('TMDL files: {0}' -f $result.tmdlFileCount))
$lines.Add(('Report metadata files: {0}' -f $result.reportMetadataFileCount))
$lines.Add(('Model metadata files: {0}' -f $result.modelMetadataFileCount))
$lines.Add(('Platform metadata files: {0}' -f $result.platformMetadataFileCount))
$lines.Add('')
$lines.Add('## Checks')
$lines.Add('')
foreach ($check in $result.checks) {
    $lines.Add(('- [{0}] {1}: {2}' -f $check.status, $check.name, $check.detail))
}
$lines.Add('')
$lines.Add('## Roundtrip plan')
$lines.Add('')
foreach ($step in $result.roundtripPlan) {
    $lines.Add(('- {0}' -f $step))
}
$lines.Add('')
$lines.Add('## Recommendations')
$lines.Add('')
foreach ($recommendation in $result.recommendations) {
    $lines.Add(('- {0}' -f $recommendation))
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
