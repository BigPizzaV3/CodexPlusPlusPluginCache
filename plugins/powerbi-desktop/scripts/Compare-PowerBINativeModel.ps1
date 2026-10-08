param([Parameter(Mandatory=$true)][string]$BeforePath, [Parameter(Mandatory=$true)][string]$AfterPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$semantic = & (Join-Path $scriptRoot 'Compare-PowerBISemanticModel.ps1') -BeforePath $BeforePath -AfterPath $AfterPath -Json | ConvertFrom-Json
$beforeFiles = @(Get-ChildItem -LiteralPath $BeforePath -Recurse -File | ForEach-Object { $_.FullName.Substring((Resolve-Path $BeforePath).Path.Length).TrimStart('\') })
$afterFiles = @(Get-ChildItem -LiteralPath $AfterPath -Recurse -File | ForEach-Object { $_.FullName.Substring((Resolve-Path $AfterPath).Path.Length).TrimStart('\') })
$fileChanges = @(
    $beforeFiles | Where-Object { $afterFiles -notcontains $_ } | ForEach-Object { [pscustomobject]@{ type = 'RemovedFile'; path = $_; risk = 'Medium' } }
    $afterFiles | Where-Object { $beforeFiles -notcontains $_ } | ForEach-Object { [pscustomobject]@{ type = 'AddedFile'; path = $_; risk = 'Low' } }
)
$result = [pscustomobject]@{ schema = 'codex.powerbi.nativeModelCompare.v1'; generated = (Get-Date).ToString('s'); semanticChangeCount = $semantic.changeCount; fileChangeCount = @($fileChanges).Count; semanticChanges = @($semantic.changes); fileChanges = @($fileChanges) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI Native Model Compare', '', "Semantic changes: $($result.semanticChangeCount)", "File changes: $($result.fileChangeCount)")
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content

