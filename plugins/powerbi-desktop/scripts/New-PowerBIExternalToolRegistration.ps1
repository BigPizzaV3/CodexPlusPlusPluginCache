param(
    [string]$PluginRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path,
    [string]$OutputPath,
    [switch]$Json,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'

$resolvedPluginRoot = (Resolve-Path -LiteralPath $PluginRoot).Path
if (-not $OutputPath) {
    $OutputPath = Join-Path $resolvedPluginRoot 'external-tools/Codex Power BI Workbench.pbitool.json'
}
$resolvedOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$scriptPath = Join-Path $resolvedPluginRoot 'scripts/Invoke-PowerBIUnifiedReview.ps1'
$arguments = @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ('"{0}"' -f $scriptPath),
    '-Path',
    '"%PBIX%"',
    '-OutputDirectory',
    '"%TEMP%\CodexPowerBIUnifiedReview"'
) -join ' '

$tool = [ordered]@{
    version = '1.0'
    name = 'Codex Power BI Workbench'
    description = 'Runs the Codex Power BI unified local review package for the current report or PBIP project.'
    path = 'powershell.exe'
    arguments = $arguments
    iconData = ''
}

$jsonText = $tool | ConvertTo-Json -Depth 5
Set-Content -LiteralPath $resolvedOutputPath -Value $jsonText -Encoding UTF8

$installPath = $null
if ($Install) {
    $installDirectory = Join-Path $env:CommonProgramFiles 'Microsoft Shared\Power BI Desktop\External Tools'
    New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
    $installPath = Join-Path $installDirectory (Split-Path -Leaf $resolvedOutputPath)
    Copy-Item -LiteralPath $resolvedOutputPath -Destination $installPath -Force
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.externalToolRegistration.v1'
    generated = (Get-Date).ToString('s')
    outputPath = $resolvedOutputPath
    installed = [bool]$Install
    installPath = $installPath
    tool = $tool
    nextSteps = @(
        'Restart Power BI Desktop after installing the .pbitool.json file.',
        'Open External Tools and choose Codex Power BI Workbench.',
        'Review generated files before applying any PBIP/TMDL drafts.'
    )
}

if ($Json) {
    $result | ConvertTo-Json -Depth 8
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI External Tool Registration')
$lines.Add('')
$lines.Add(('- Output: `{0}`' -f $result.outputPath))
$lines.Add(('- Installed: {0}' -f $result.installed))
if ($result.installPath) { $lines.Add(('- Install path: `{0}`' -f $result.installPath)) }
$lines.Add('')
$lines.Add('```json')
$lines.Add($jsonText)
$lines.Add('```')
$lines.Add('')
$lines.Add('## Next steps')
$lines.Add('')
foreach ($step in $result.nextSteps) {
    $lines.Add(('- {0}' -f $step))
}

($lines -join [Environment]::NewLine) + [Environment]::NewLine
