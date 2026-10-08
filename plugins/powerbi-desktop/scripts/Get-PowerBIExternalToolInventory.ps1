param([switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envInfo = & (Join-Path $scriptRoot 'Test-PowerBIEnvironment.ps1') -Json | ConvertFrom-Json
$toolDefs = @(
    @{ name = 'Power BI Desktop'; key = 'PowerBIDesktop'; category = 'Authoring'; role = 'Open, inspect, and validate reports manually.' },
    @{ name = 'Tabular Editor'; key = 'TabularEditor'; category = 'Model Authoring'; role = 'BPA, TMDL/model editing, calculation groups, scripted model changes.' },
    @{ name = 'DAX Studio'; key = 'DaxStudio'; category = 'DAX Performance'; role = 'Query execution, server timings, query plans, and VertiPaq analysis.' },
    @{ name = 'ALM Toolkit'; key = 'ALMToolkit'; category = 'Deployment Compare'; role = 'Dataset/model compare, merge, and deployment review.' },
    @{ name = 'Power BI Helper'; key = 'PowerBIHelper'; category = 'Documentation'; role = 'Model/report documentation and dependency exploration.' },
    @{ name = 'Model Documenter'; key = 'ModelDocumenter'; category = 'Documentation'; role = 'External model documentation output.' },
    @{ name = 'PBI.tips Tools'; key = 'PBITips'; category = 'Design'; role = 'Theme, layout, and report design utilities.' },
    @{ name = 'pbi-tools'; key = 'PbiTools'; category = 'Source Control'; role = 'PBIX extraction, PBIP/source-control automation, and deployment scripts.' }
)
$tools = foreach ($def in $toolDefs) {
    $path = $envInfo.($def.key)
    [pscustomobject]@{ name = $def.name; key = $def.key; category = $def.category; installed = [bool]$path; path = $path; role = $def.role }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.externalToolInventory.v1'; generated = (Get-Date).ToString('s'); installedCount = @($tools | Where-Object installed).Count; toolCount = @($tools).Count; tools = @($tools) }
if ($Json) { $result | ConvertTo-Json -Depth 6; return }
$result.tools | Format-Table name, installed, path, category -AutoSize

