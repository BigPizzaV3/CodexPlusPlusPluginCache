param(
    [string]$Path = ".",
    [string]$OutputDirectory = "powerbi-unified-review",
    [switch]$SkipLive
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null

$paths = [ordered]@{
    OfflineReview = Join-Path $resolvedOut 'offline-review'
    LiveReview = Join-Path $resolvedOut 'live-review'
    ExternalToolRegistration = Join-Path $resolvedOut 'external-tool/Codex Power BI Workbench.pbitool.json'
}

$offline = & (Join-Path $scriptRoot 'Invoke-PowerBIAutoReview.ps1') -Path $Path -OutputDirectory $paths.OfflineReview
$registration = & (Join-Path $scriptRoot 'New-PowerBIExternalToolRegistration.ps1') -OutputPath $paths.ExternalToolRegistration -Json | ConvertFrom-Json

$live = $null
$liveStatus = 'Skipped'
$liveDetail = 'Skipped by request.'
if (-not $SkipLive) {
    try {
        $connection = & (Join-Path $scriptRoot 'Get-PowerBIDesktopLiveConnection.ps1') -Json | ConvertFrom-Json
        if ($connection.powerBIDesktopRunning -and $connection.connectionString) {
            $live = & (Join-Path $scriptRoot 'Invoke-PowerBILiveAutoReview.ps1') -OutputDirectory $paths.LiveReview
            $liveStatus = 'Completed'
            $liveDetail = $connection.connectionString
        }
        else {
            $liveStatus = 'NotAvailable'
            $liveDetail = 'Power BI Desktop live endpoint was not detected.'
        }
    }
    catch {
        $liveStatus = 'Failed'
        $liveDetail = $_.Exception.Message
    }
}

$summary = [pscustomobject]@{
    schema = 'codex.powerbi.unifiedReview.v1'
    generated = (Get-Date).ToString('s')
    source = (Resolve-Path -LiteralPath $Path).Path
    outputDirectory = $resolvedOut
    offlineReview = $offline.Index
    liveStatus = $liveStatus
    liveDetail = $liveDetail
    liveReview = if ($live) { $live.Index } else { $null }
    externalToolRegistration = $registration.outputPath
}
$summaryPath = Join-Path $resolvedOut 'summary.json'
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

$index = New-Object System.Collections.Generic.List[string]
$index.Add('# Power BI Unified Review')
$index.Add('')
$index.Add(('Source: `{0}`' -f $summary.source))
$index.Add(('Generated: {0}' -f $summary.generated))
$index.Add('')
$index.Add('## Status')
$index.Add('')
$index.Add(('- Offline review: `{0}`' -f $summary.offlineReview))
$index.Add(('- Live review: {0}' -f $summary.liveStatus))
$index.Add(('- Live detail: {0}' -f $summary.liveDetail))
$index.Add(('- External tool registration: `{0}`' -f $summary.externalToolRegistration))
$index.Add(('- Summary JSON: `{0}`' -f $summaryPath))
$index.Add('')
$index.Add('## Recommended reading order')
$index.Add('')
$index.Add('1. Offline review README')
$index.Add('2. Live review README when available')
$index.Add('3. Trust release gate')
$index.Add('4. Fix backlog and DAX fix drafts')
$index.Add('5. External tool registration file')

$indexPath = Join-Path $resolvedOut 'README.md'
Set-Content -LiteralPath $indexPath -Value (($index -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

[pscustomobject]@{
    OutputDirectory = $resolvedOut
    Index = $indexPath
    Summary = $summaryPath
    LiveStatus = $liveStatus
}
