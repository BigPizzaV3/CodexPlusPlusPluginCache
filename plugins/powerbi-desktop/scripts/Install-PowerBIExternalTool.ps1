param(
    [string]$PluginRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path,
    [string]$Name = 'Codex Power BI Workbench',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$registration = & (Join-Path $PSScriptRoot 'New-PowerBIExternalToolRegistration.ps1') -PluginRoot $PluginRoot -Json | ConvertFrom-Json
$sourcePath = $registration.outputPath
$installDirectory = Join-Path $env:CommonProgramFiles 'Microsoft Shared\Power BI Desktop\External Tools'
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null

$fileName = ($Name -replace '[\\/:*?"<>|]', '').Trim()
if (-not $fileName) { $fileName = 'Codex Power BI Workbench' }
$targetPath = Join-Path $installDirectory ($fileName + '.pbitool.json')
Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force

$result = [pscustomobject]@{
    schema = 'codex.powerbi.externalToolInstall.v1'
    installed = $true
    sourcePath = $sourcePath
    targetPath = $targetPath
    requiresPowerBIRestart = $true
}

if ($Json) {
    $result | ConvertTo-Json -Depth 5
    return
}

$result
