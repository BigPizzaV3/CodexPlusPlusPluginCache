param(
    [string]$Server,
    [Parameter(Mandatory = $true)]
    [string]$Query,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$dmvScript = Join-Path $PSScriptRoot 'Invoke-PowerBILiveDmv.ps1'
& $dmvScript -Server $Server -Query $Query -Json:$Json
