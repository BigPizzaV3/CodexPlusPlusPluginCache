param([string]$Path = ".", [string]$ReviewDirectory, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Path).Path
$artifactRoot = if ($ReviewDirectory -and (Test-Path -LiteralPath $ReviewDirectory)) { (Resolve-Path -LiteralPath $ReviewDirectory).Path } else { $root }
$files = @(Get-ChildItem -LiteralPath $artifactRoot -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName)
$hashes = foreach ($file in $files) {
    $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
    [pscustomobject]@{ path = $file.FullName; sha256 = $hash.Hash; bytes = $file.Length }
}
$combined = [string]::Join('|', @($hashes | ForEach-Object { $_.sha256 }))
$bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
$sha = [System.Security.Cryptography.SHA256]::Create()
$signature = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
$result = [pscustomobject]@{ schema = 'codex.powerbi.releaseEvidenceSignature.v1'; root = $root; evidenceRoot = $artifactRoot; generated = (Get-Date).ToString('s'); artifactCount = $files.Count; signatureAlgorithm = 'SHA256'; evidenceSignature = $signature; artifacts = @($hashes) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Release Evidence Signature`n`nSignature: `$($result.evidenceSignature)`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
