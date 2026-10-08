param([string]$Path = ".", [string]$OutputDirectory = "powerbi-real-feature-review")
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null
$outputs = [ordered]@{
    VisualSchema = Join-Path $resolvedOut 'visual-schema-check.json'
    RenderReadiness = Join-Path $resolvedOut 'render-readiness.json'
    VertiPaq = Join-Path $resolvedOut 'vertipaq-analyzer.json'
    ServicePlan = Join-Path $resolvedOut 'service-integration-plan.md'
    SchemaVisualPlan = Join-Path $resolvedOut 'schema-aware-visual-plan.json'
}
& (Join-Path $scriptRoot 'Test-PowerBIVisualSchema.ps1') -Path $Path -Json -OutputPath $outputs.VisualSchema | Out-Null
& (Join-Path $scriptRoot 'Test-PowerBIReportRenderReadiness.ps1') -Path $Path -Json -OutputPath $outputs.RenderReadiness | Out-Null
& (Join-Path $scriptRoot 'Get-PowerBILiveVertiPaqAnalyzer.ps1') -Json -OutputPath $outputs.VertiPaq | Out-Null
& (Join-Path $scriptRoot 'New-PowerBIServiceIntegrationPlan.ps1') -OutputPath $outputs.ServicePlan | Out-Null
& (Join-Path $scriptRoot 'New-PowerBISchemaAwareVisualPlan.ps1') -Path $Path -Measure 'Total Sales' -Json -OutputPath $outputs.SchemaVisualPlan | Out-Null
$index = @('# Power BI Real Feature Review', '', '## Artifacts') + @($outputs.GetEnumerator() | ForEach-Object { '- {0}: `{1}`' -f $_.Key, $_.Value })
$indexPath = Join-Path $resolvedOut 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8
[pscustomobject]@{ OutputDirectory = $resolvedOut; Index = $indexPath }

