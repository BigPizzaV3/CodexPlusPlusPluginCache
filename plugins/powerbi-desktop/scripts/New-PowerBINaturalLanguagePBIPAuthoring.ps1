param([Parameter(Mandatory=$true)][string]$Intent, [string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog=&(Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json|ConvertFrom-Json
$tokens=@($Intent -split '[^\p{L}\p{Nd}_%]+'|Where-Object{$_.Length -gt 2})
$measures=@($catalog.metrics|Where-Object{ $m=$_; @($tokens|Where-Object{ $m.name -match [regex]::Escape($_) -or $m.expression -match [regex]::Escape($_)}).Count -gt 0 }|Select-Object -First 4 -ExpandProperty name)
if($measures.Count -eq 0){$measures=@($catalog.metrics|Select-Object -First 4 -ExpandProperty name)}
$page=&(Join-Path $scriptRoot 'New-PowerBIReportPageDraft.ps1') -PageName 'AI Authored Page' -Measures $measures -Json|ConvertFrom-Json
$result=[pscustomobject]@{schema='codex.powerbi.naturalLanguagePbipAuthoring.v1'; intent=$Intent; selectedMeasures=$measures; pageDraft=$page; requiredFollowUp=@('Validate measure semantics','Apply with Add-PowerBIPBIPReportPage.ps1','Run report layout checks')}
if($Json){$text=$result|ConvertTo-Json -Depth 14;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
if($OutputPath){$result|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $OutputPath -Encoding UTF8}; $result
