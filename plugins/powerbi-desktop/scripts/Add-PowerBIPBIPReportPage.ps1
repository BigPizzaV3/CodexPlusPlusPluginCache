param(
    [Parameter(Mandatory=$true)][string]$PbipPath,
    [string]$PageName = 'New Page',
    [string[]]$Measures = @(),
    [switch]$Apply,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PbipPath)
$page = & (Join-Path $scriptRoot 'New-PowerBIReportPageDraft.ps1') -PageName $PageName -Measures $Measures -Json | ConvertFrom-Json

$reportRoot = Join-Path $resolvedRoot 'Report'
$pagesRoot = Join-Path $reportRoot 'pages'
$pagePath = Join-Path $pagesRoot $page.pageId
$pageJsonPath = Join-Path $pagePath 'page.json'
$backupPath = $null

if ($Apply) {
    New-Item -ItemType Directory -Force -Path $pagePath | Out-Null
    if (Test-Path -LiteralPath $pageJsonPath) {
        $backupPath = "$pageJsonPath.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
        Copy-Item -LiteralPath $pageJsonPath -Destination $backupPath
    }
    $page.pbipDraft | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $pageJsonPath -Encoding UTF8
    $manifestPath = Join-Path $pagesRoot 'pages.json'
    $manifest = [ordered]@{ pages = @() }
    if (Test-Path -LiteralPath $manifestPath) {
        try { $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json } catch { $manifest = [ordered]@{ pages = @() } }
    }
    $existing = @($manifest.pages | Where-Object { $_.name -eq $page.pageId })
    if ($existing.Count -eq 0) {
        $manifestPages = @($manifest.pages) + [pscustomobject]@{ name = $page.pageId; displayName = $PageName }
        [pscustomobject]@{ pages = $manifestPages } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.pbipReportPageApply.v1'
    pbipPath = $resolvedRoot
    applied = [bool]$Apply
    pageName = $PageName
    pageId = $page.pageId
    pagePath = $pageJsonPath
    backupPath = $backupPath
    draft = $page
    rollback = 'Delete the generated page folder or restore the backup path if present.'
}
if ($Json) { $result | ConvertTo-Json -Depth 14; return }
$result

