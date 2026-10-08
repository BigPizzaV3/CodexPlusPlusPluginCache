param(
    [ValidateSet('On', 'Off', 'Toggle', 'Playroom', 'Switch', 'Familiar', 'Exit')]
    [string]$Action = 'On',
    [string]$PetId = '',
    [ValidateSet('P1','P2')]
    [string]$Player = 'P1',
    [ValidateSet('idle','user-active','codex-working','completed','needs-input','permission-required','succeeded','failed','returning-user','celebrate','wait','sleep','greet')]
    [string]$FamiliarEvent = 'idle'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$pluginRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$launcher = Join-Path $pluginRoot 'game-mode.ps1'

if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "Windowisp launcher not found at $launcher"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -Action $Action -PetId $PetId -Player $Player -FamiliarEvent $FamiliarEvent
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
