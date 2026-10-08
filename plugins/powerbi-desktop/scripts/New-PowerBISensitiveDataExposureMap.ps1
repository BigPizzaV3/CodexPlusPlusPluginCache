param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path -LiteralPath $Path).Path
$visual=& (Join-Path $scriptRoot 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $root -Json|ConvertFrom-Json
$patterns='ssn|social|salary|payroll|email|phone|address|birth|dob|medical|health|patient|iban|bank|credit|card|contact|customer'
$files=@(Get-ChildItem -LiteralPath $root -Recurse -File -Include *.tmdl,*.dax,*.pq,*.json -ErrorAction SilentlyContinue)
$fields=foreach($file in $files){
 try{$text=Get-Content -Raw -LiteralPath $file.FullName}catch{continue}
 if($text -match $patterns){
  $matches=[regex]::Matches($text,"(?i)\b($patterns)\w*\b")|Select-Object -First 20
  foreach($m in $matches){[pscustomobject]@{name=$m.Value;table=$file.BaseName;description='Sensitive term found in model/report text.'}}
 }
}
$items=foreach($field in $fields){
 [pscustomobject]@{field=$field.name;table=$field.table;exposure='ModelColumn';visualReferenceCount=@($visual.impacts|Where-Object{$_.field -eq $field.name -or $_.column -eq $field.name}).Count;risk=if($field.name -match 'ssn|salary|iban|bank|credit|medical|patient'){'High'}else{'Medium'};reviewAction='Confirm sensitivity label, RLS coverage, tooltip/export exposure, and owner sign-off.'}
}
$result=[pscustomobject]@{schema='codex.powerbi.sensitiveDataExposureMap.v1';generated=(Get-Date).ToString('s');source=$root;exposureCount=@($items).Count;highRiskCount=@($items|Where-Object risk -eq 'High').Count;exposures=@($items)}
if($Json){$text=$result|ConvertTo-Json -Depth 8;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$lines=@('# Power BI Sensitive Data Exposure Map','',"Exposures: $($result.exposureCount)",'')+@($items|ForEach-Object{"- [$($_.risk)] $($_.table)[$($_.field)]: $($_.reviewAction)"})
$content=($lines-join[Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
