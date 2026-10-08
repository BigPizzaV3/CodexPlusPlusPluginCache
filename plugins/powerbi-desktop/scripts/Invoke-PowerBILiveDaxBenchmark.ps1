param([string[]]$Queries = @('EVALUATE ROW("Ping", 1)'), [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$results = New-Object System.Collections.Generic.List[object]
foreach ($query in $Queries) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 'Skipped'; $errorText = $null
    try {
        & (Join-Path $scriptRoot 'Invoke-PowerBILiveDaxQuery.ps1') -Query $query | Out-Null
        $status = 'Passed'
    } catch {
        $status = 'Failed'
        $errorText = $_.Exception.Message
    }
    $sw.Stop()
    $results.Add([pscustomobject]@{ query = $query; status = $status; elapsedMs = $sw.ElapsedMilliseconds; error = $errorText })
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.liveDaxBenchmark.v1'; generated = (Get-Date).ToString('s'); benchmarkCount = $results.Count; results = @($results.ToArray()); note = 'Elapsed time is end-to-end XMLA call timing, not DAX Studio Server Timings.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

