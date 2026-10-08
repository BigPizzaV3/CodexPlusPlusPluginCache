param([string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$inventory = & (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json
$capabilities = @(
    'Inventory', 'Model documentation', 'DAX validation', 'DAX performance tracing', 'Best Practice Analyzer',
    'Calculation groups', 'Model compare/merge', 'PBIX extraction', 'PBIP source control', 'Theme/layout design',
    'Trust release gate', 'AI guided fixes'
)
$map = @{
    'Power BI Desktop' = @('Inventory', 'DAX validation')
    'Tabular Editor' = @('Best Practice Analyzer', 'Calculation groups', 'Model documentation')
    'DAX Studio' = @('DAX validation', 'DAX performance tracing')
    'ALM Toolkit' = @('Model compare/merge')
    'Power BI Helper' = @('Inventory', 'Model documentation')
    'Model Documenter' = @('Model documentation')
    'PBI.tips Tools' = @('Theme/layout design')
    'pbi-tools' = @('PBIX extraction', 'PBIP source control')
    'Codex Power BI Plugin' = @('Inventory', 'Model documentation', 'DAX validation', 'PBIP source control', 'Trust release gate', 'AI guided fixes')
}
$rows = foreach ($toolName in ($map.Keys | Sort-Object)) {
    $inv = @($inventory.tools | Where-Object { $_.name -eq $toolName } | Select-Object -First 1)
    [pscustomobject]@{ tool = $toolName; installed = $(if ($toolName -eq 'Codex Power BI Plugin') { $true } else { [bool]$inv.installed }); capabilities = @($map[$toolName]); missingCapabilities = @($capabilities | Where-Object { $map[$toolName] -notcontains $_ }) }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.externalToolCapabilityMatrix.v1'; generated = (Get-Date).ToString('s'); toolCount = @($rows).Count; capabilityCount = $capabilities.Count; capabilities = $capabilities; tools = @($rows) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI External Tool Capability Matrix', '') + @($rows | ForEach-Object { "## $($_.tool)`n- Installed: $($_.installed)`n- Capabilities: $($_.capabilities -join ', ')`n" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

