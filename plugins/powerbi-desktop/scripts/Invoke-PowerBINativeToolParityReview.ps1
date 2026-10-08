param([string]$Path = ".", [string]$OutputDirectory = "powerbi-native-tool-parity")
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null
$outputs = [ordered]@{
    NativeBpa = Join-Path $resolvedOut 'native-bpa.md'
    Documentation = Join-Path $resolvedOut 'native-model-documentation.md'
    Performance = Join-Path $resolvedOut 'native-performance-profile.md'
    Layout = Join-Path $resolvedOut 'native-layout-best-practices.json'
    Theme = Join-Path $resolvedOut 'native-theme-audit.json'
    SourceControl = Join-Path $resolvedOut 'pbip-source-control-plan.md'
}
& (Join-Path $scriptRoot 'Invoke-PowerBINativeBpa.ps1') -Path $Path -OutputPath $outputs.NativeBpa | Out-Null
& (Join-Path $scriptRoot 'New-PowerBINativeModelDocumentation.ps1') -Path $Path -OutputPath $outputs.Documentation | Out-Null
& (Join-Path $scriptRoot 'New-PowerBINativePerformanceProfile.ps1') -Path $Path -OutputPath $outputs.Performance | Out-Null
& (Join-Path $scriptRoot 'Test-PowerBIReportLayoutBestPractices.ps1') -Path $Path -Json -OutputPath $outputs.Layout | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIThemeAudit.ps1') -Json -OutputPath $outputs.Theme | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIPBIPSourceControlPlan.ps1') -Path $Path -OutputPath $outputs.SourceControl | Out-Null
$index = @('# Power BI Native Tool Parity Review', '', 'These artifacts implement common external-tool capabilities natively where file/live metadata allows it.', '', '## Artifacts') + @($outputs.GetEnumerator() | ForEach-Object { '- {0}: `{1}`' -f $_.Key, $_.Value })
$indexPath = Join-Path $resolvedOut 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8
[pscustomobject]@{ OutputDirectory = $resolvedOut; Index = $indexPath }
