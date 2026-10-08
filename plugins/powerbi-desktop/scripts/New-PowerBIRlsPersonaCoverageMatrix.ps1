param([string]$Path='.', [string]$RolesPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$rls=& (Join-Path $scriptRoot 'Test-PowerBIRlsLeakage.ps1') -Path $root -RolesPath $RolesPath -Json|ConvertFrom-Json
$visual=& (Join-Path $scriptRoot 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $root -Json|ConvertFrom-Json
$rows=foreach($role in @($rls.roleTests)){
 [pscustomobject]@{persona=$role.roleName;table=$role.tableName;hasPositiveTest=$true;hasNegativeTest=@($role.expectedPolicy.deniedValues).Count -gt 0;visualReferenceCount=@($visual.impacts|Where-Object{$_.table -eq $role.tableName}).Count;coverageStatus=if(@($role.expectedPolicy.deniedValues).Count -gt 0){'Covered'}else{'NeedsNegativeExpectation'};releaseGateImpact=$role.releaseGateImpact}
}
$result=[pscustomobject]@{schema='codex.powerbi.rlsPersonaCoverageMatrix.v1';generated=(Get-Date).ToString('s');source=$root;personaCount=@($rows).Count;coverageGapCount=@($rows|Where-Object coverageStatus -ne 'Covered').Count;personas=@($rows)}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI RLS Persona Coverage Matrix','',"Coverage gaps: $($result.coverageGapCount)",'')+@($rows|ForEach-Object{"- [$($_.coverageStatus)] $($_.persona) on $($_.table)"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
