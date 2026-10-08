param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$contracts = & (Join-Path $scriptRoot 'New-PowerBIKpiTrustContract.ps1') -Path $Path -Json | ConvertFrom-Json
$items = foreach($c in @($contracts.contracts)){[pscustomobject]@{name=$c.measure; type='KPI'; owner=$c.owner; grain=$c.grain; sourceSystem=$c.sourceSystem; freshnessSla=$c.sla; breakingChangeRules=@('Rename requires downstream approval','Expression change requires expectation tests','Risk increase blocks release'); publishCriteria=@('Trust score reviewed','Owner assigned','Acceptance test present'); testQuery=("EVALUATE ROW(`"{0}`", [{0}])" -f $c.measure)}}
$result=[pscustomobject]@{schema='codex.powerbi.dataContract.v1'; generated=(Get-Date).ToString('s'); contractCount=@($items).Count; contracts=@($items)}
if($Json){$text=$result|ConvertTo-Json -Depth 10; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8}; $text; return}
$md=@('# Power BI Data Contracts','')+@($items|ForEach-Object{"## $($_.name)`n- Owner: $($_.owner)`n- Grain: $($_.grain)`n- SLA: $($_.freshnessSla)`n"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8}; $content
