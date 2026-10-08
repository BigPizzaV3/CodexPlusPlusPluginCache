param([Parameter(Mandatory=$true)][string]$BeforePath, [Parameter(Mandatory=$true)][string]$AfterPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$before = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $BeforePath -Json | ConvertFrom-Json
$after = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $AfterPath -Json | ConvertFrom-Json
$beforeById = @{}; foreach ($m in @($before.metrics)) { $beforeById[$m.id] = $m }
$afterById = @{}; foreach ($m in @($after.metrics)) { $afterById[$m.id] = $m }
$changes = New-Object System.Collections.Generic.List[object]
foreach ($id in $beforeById.Keys) {
    if (-not $afterById.ContainsKey($id)) { $changes.Add([pscustomobject]@{ type = 'RemovedMeasure'; id = $id; risk = 'High'; detail = 'Measure removed.' }) }
    elseif ($beforeById[$id].expression -ne $afterById[$id].expression) { $changes.Add([pscustomobject]@{ type = 'ChangedMeasure'; id = $id; risk = 'Medium'; detail = 'Measure expression changed.' }) }
}
foreach ($id in $afterById.Keys) { if (-not $beforeById.ContainsKey($id)) { $changes.Add([pscustomobject]@{ type = 'AddedMeasure'; id = $id; risk = 'Low'; detail = 'Measure added.' }) } }
$result = [pscustomobject]@{ schema = 'codex.powerbi.semanticDiff.v1'; before = $before.root; after = $after.root; generated = (Get-Date).ToString('s'); changeCount = $changes.Count; changes = @($changes) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Semantic Diff', '', "Changes: $($result.changeCount)", '') + @($result.changes | ForEach-Object { "- [$($_.risk)] $($_.type): `$($_.id)` - $($_.detail)" })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

