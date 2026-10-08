param(
    [string]$Name = 'Codex Power BI Workbench',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$installDirectory = Join-Path $env:CommonProgramFiles 'Microsoft Shared\Power BI Desktop\External Tools'
$fileName = ($Name -replace '[\\/:*?"<>|]', '').Trim()
if (-not $fileName) { $fileName = 'Codex Power BI Workbench' }
$targetPath = Join-Path $installDirectory ($fileName + '.pbitool.json')
$existed = Test-Path -LiteralPath $targetPath
if ($existed) {
    Remove-Item -LiteralPath $targetPath -Force
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.externalToolUninstall.v1'
    removed = $existed
    targetPath = $targetPath
    requiresPowerBIRestart = $existed
}

if ($Json) {
    $result | ConvertTo-Json -Depth 5
    return
}

$result
