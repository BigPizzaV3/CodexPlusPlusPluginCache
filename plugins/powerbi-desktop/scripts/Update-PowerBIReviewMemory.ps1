param([string]$Path='.', [string]$MemoryPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $MemoryPath){$MemoryPath=Join-Path (Split-Path -Parent $scriptRoot) 'rules/powerbi-review-memory.json'}
$gate=&(Join-Path $scriptRoot 'New-PowerBITrustReleaseGate.ps1') -Path $Path -Json|ConvertFrom-Json
$fixes=&(Join-Path $scriptRoot 'New-PowerBIGuidedFixPlan.ps1') -Path $Path -Json|ConvertFrom-Json
$memory=if(Test-Path -LiteralPath $MemoryPath){Get-Content -Raw -LiteralPath $MemoryPath|ConvertFrom-Json}else{[pscustomobject]@{schema='codex.powerbi.reviewMemory.v1'; reviews=@()}}
$reviews=@($memory.reviews)+@([pscustomobject]@{generated=(Get-Date).ToString('s'); path=(Resolve-Path -LiteralPath $Path).Path; decision=$gate.decision; fixCount=$fixes.fixCount; p0Count=@($fixes.fixes|Where-Object priority -eq 'P0').Count})
$newMemory=[pscustomobject]@{schema='codex.powerbi.reviewMemory.v1'; reviews=@($reviews)}
$newMemory|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $MemoryPath -Encoding UTF8
$result=[pscustomobject]@{schema='codex.powerbi.reviewMemoryUpdate.v1'; memoryPath=$MemoryPath; reviewCount=@($newMemory.reviews).Count; latest=@($newMemory.reviews)[-1]}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$result
