param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$decision=&(Join-Path $scriptRoot 'New-PowerBIDecisionRiskAssistant.ps1') -Path $Path -Json|ConvertFrom-Json
$intent=&(Join-Path $scriptRoot 'New-PowerBIVisualIntentAnalyzer.ps1') -Path $Path -Json|ConvertFrom-Json
$scenarios=foreach($risk in @($decision.decisionRisks|Select-Object -First 10)){[pscustomobject]@{question=("Can leadership rely on {0}?" -f $risk.metric); answer=$(if($risk.trustScore -lt 60){'No, release risk is high.'}elseif($risk.trustScore -lt 80){'Only with caveats.'}else{'Yes after sign-off.'}); missingContext=$(if($risk.trustScore -lt 80){@('Benchmark','Owner sign-off','Definition tooltip')}else{@()}); affectedAudience=$risk.affectedAudience}}
$result=[pscustomobject]@{schema='codex.powerbi.reportDecisionSimulator.v1'; generated=(Get-Date).ToString('s'); pageIntentCount=$intent.pageCount; scenarioCount=@($scenarios).Count; scenarios=@($scenarios)}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI Report Decision Simulator','')+@($scenarios|ForEach-Object{"## $($_.question)`n- Answer: $($_.answer)`n- Audience: $($_.affectedAudience)`n"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
