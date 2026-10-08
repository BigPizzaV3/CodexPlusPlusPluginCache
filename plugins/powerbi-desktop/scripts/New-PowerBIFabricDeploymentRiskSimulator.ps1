param([string]$Path = ".", [string]$WorkspaceName='[TODO: Fabric workspace]', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$fabric=&(Join-Path $scriptRoot 'New-PowerBIFabricReadinessPlan.ps1') -Path $Path -WorkspaceName $WorkspaceName -Json|ConvertFrom-Json
$gate=&(Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -Json|ConvertFrom-Json
$risks=@(
 [pscustomobject]@{environment='Dev'; risk=$(if($fabric.pbipReadiness -eq 'Ready'){'Low'}else{'Medium'}); action='Validate PBIP source-control structure.'},
 [pscustomobject]@{environment='Test'; risk=$(if($gate.decision -eq 'No-Go'){'High'}else{'Medium'}); action='Run golden baselines and measure expectations before deployment pipeline promotion.'},
 [pscustomobject]@{environment='Prod'; risk=$(if($gate.decision -eq 'Go'){'Low'}else{'High'}); action='Require rollback plan and owner approval before publish.'}
)
$result=[pscustomobject]@{schema='codex.powerbi.fabricDeploymentRiskSimulator.v1'; generated=(Get-Date).ToString('s'); workspaceName=$WorkspaceName; releaseDecision=$gate.decision; riskCount=$risks.Count; risks=$risks; rollbackPlan=@('Keep previous PBIX/PBIP artifact','Revert semantic model changes','Re-run trust gate after rollback')}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI Fabric Deployment Risk Simulator','',"Release decision: $($gate.decision)",'')+@($risks|ForEach-Object{"- [$($_.environment)] $($_.risk): $($_.action)"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
