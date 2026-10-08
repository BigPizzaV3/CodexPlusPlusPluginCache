param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Path).Path
$files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Include *.pq,*.m,*.tmdl -ErrorAction SilentlyContinue)
$findings = New-Object System.Collections.Generic.List[object]
foreach ($file in $files) {
    $text = Get-Content -Raw -LiteralPath $file.FullName
    if ($text -match '(?i)C:\\|/Users/|File\.Contents|Folder\.Files') { $findings.Add([pscustomobject]@{ severity = 'High'; source = $file.Name; area = 'SourcePath'; message = 'Local file/folder source path detected; gateway and deployment contract need review.' }) | Out-Null }
    if ($text -match '(?i)Web\.Contents' -and $text -notmatch '(?i)RelativePath') { $findings.Add([pscustomobject]@{ severity = 'Medium'; source = $file.Name; area = 'WebSource'; message = 'Web.Contents source may need parameterized relative path and privacy review.' }) | Out-Null }
    if ($text -match '(?i)Table\.TransformColumnTypes' -eq $false -and $file.Extension -in @('.pq','.m')) { $findings.Add([pscustomobject]@{ severity = 'Medium'; source = $file.Name; area = 'SchemaContract'; message = 'No explicit column type transform detected.' }) | Out-Null }
    if ($text -match '(?i)Table\.Buffer|List\.Buffer') { $findings.Add([pscustomobject]@{ severity = 'Medium'; source = $file.Name; area = 'Folding'; message = 'Buffering may prevent query folding.' }) | Out-Null }
}
if ($files.Count -eq 0) { $findings.Add([pscustomobject]@{ severity = 'Info'; source = $root; area = 'Evidence'; message = 'No Power Query files found; export PBIP/TMDL/M to enable contract review.' }) | Out-Null }
$result = [pscustomobject]@{ schema = 'codex.powerbi.powerQueryDataContract.v1'; root = $root; generated = (Get-Date).ToString('s'); queryFileCount = $files.Count; status = if (@($findings.ToArray() | Where-Object severity -eq 'High').Count -gt 0) { 'ContractRisk' } elseif ($findings.Count -gt 0) { 'NeedsReview' } else { 'Passed' }; findingCount = $findings.Count; findings = @($findings.ToArray()) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Power Query Data Contract`n`nStatus: **$($result.status)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
