param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$sim=&(Join-Path $scriptRoot 'New-PowerBIDaxFixSimulation.ps1') -Path $Path -Json|ConvertFrom-Json
$items=foreach($s in @($sim.simulations)){[pscustomobject]@{measure=$s.measure; risk=$s.risk; changedWhat='Generated a safer draft expression from known DAX risk patterns.'; why='Reduce semantic or performance risk while preserving intended KPI meaning where possible.'; semanticCaveat='Must be validated against accepted business totals and filter contexts.'; tests=@($s.validationQueries); rollback=$s.rollbackNote; originalDax=$s.originalDax; refactoredDax=$s.simulatedDax}}
$result=[pscustomobject]@{schema='codex.powerbi.explainableDaxRefactoring.v1'; generated=(Get-Date).ToString('s'); refactorCount=@($items).Count; refactorings=@($items)}
if($Json){$text=$result|ConvertTo-Json -Depth 10;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI Explainable DAX Refactoring','')+@($items|ForEach-Object{"## $($_.measure)`n- Why: $($_.why)`n- Caveat: $($_.semanticCaveat)`n"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
