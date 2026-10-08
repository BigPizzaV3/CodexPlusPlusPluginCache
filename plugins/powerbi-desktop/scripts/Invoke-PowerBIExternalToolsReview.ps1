param([string]$Path = ".", [string]$OutputDirectory = "powerbi-external-tools-review")
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null
$outputs = [ordered]@{
    Inventory = Join-Path $resolvedOut 'external-tool-inventory.json'
    CapabilityMatrix = Join-Path $resolvedOut 'external-tool-capability-matrix.md'
    TabularEditor = Join-Path $resolvedOut 'tabular-editor-workflow.md'
    DaxStudio = Join-Path $resolvedOut 'dax-studio-workflow.md'
    ALMToolkit = Join-Path $resolvedOut 'alm-toolkit-workflow.md'
    Helper = Join-Path $resolvedOut 'power-bi-helper-workflow.md'
    PbiTools = Join-Path $resolvedOut 'pbi-tools-workflow.md'
}
& (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | Set-Content -LiteralPath $outputs.Inventory -Encoding UTF8
& (Join-Path $scriptRoot 'New-PowerBIExternalToolCapabilityMatrix.ps1') -OutputPath $outputs.CapabilityMatrix | Out-Null
& (Join-Path $scriptRoot 'New-PowerBITabularEditorWorkflow.ps1') -Path $Path -OutputPath $outputs.TabularEditor | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIDaxStudioWorkflow.ps1') -Path $Path -OutputPath $outputs.DaxStudio | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIALMToolkitWorkflow.ps1') -SourcePath $Path -OutputPath $outputs.ALMToolkit | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIHelperWorkflow.ps1') -Path $Path -OutputPath $outputs.Helper | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIPbiToolsWorkflow.ps1') -Path $Path -OutputPath $outputs.PbiTools | Out-Null
$index = @('# Power BI External Tools Review', '', ('Source: `{0}`' -f (Resolve-Path -LiteralPath $Path).Path), ('Generated: {0}' -f (Get-Date).ToString('s')), '', '## Artifacts') + @($outputs.GetEnumerator() | ForEach-Object { '- {0}: `{1}`' -f $_.Key, $_.Value })
$indexPath = Join-Path $resolvedOut 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8
[pscustomobject]@{ OutputDirectory = $resolvedOut; Index = $indexPath }

