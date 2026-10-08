param([string]$PbipPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PbipPath)
$artifacts = @()
$draftManifest = Join-Path $root 'SemanticModel/drafts/draft-manifest.json'
if (Test-Path -LiteralPath $draftManifest) {
    try { $artifacts += @((Get-Content -Raw -LiteralPath $draftManifest | ConvertFrom-Json).artifacts) } catch {}
}
$queryRoot = Join-Path $root 'SemanticModel/queries'
if (Test-Path -LiteralPath $queryRoot) {
    $artifacts += @(Get-ChildItem -LiteralPath $queryRoot -File -Filter *.pq | ForEach-Object { [pscustomobject]@{ objectName = $_.BaseName; objectType = 'PowerQuery'; path = $_.FullName; applied = $null } })
}
$reportPages = Join-Path $root 'Report/pages'
if (Test-Path -LiteralPath $reportPages) {
    $artifacts += @(Get-ChildItem -LiteralPath $reportPages -Recurse -File -Filter page.json | ForEach-Object { [pscustomobject]@{ objectName = Split-Path -Leaf (Split-Path -Parent $_.FullName); objectType = 'ReportPage'; path = $_.FullName; applied = $null } })
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.pbipApplyPlan.v1'; pbipPath = $root; generated = (Get-Date).ToString('s'); artifactCount = @($artifacts).Count; artifacts = @($artifacts); validationSteps = @('Open PBIP in Power BI Desktop.', 'Refresh metadata.', 'Run generated DAX tests.', 'Run Trust Release Gate.', 'Save as PBIX only after validation.') }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

