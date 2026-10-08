param([string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$queries = @{
    Tables = 'SELECT * FROM $SYSTEM.TMSCHEMA_TABLES'
    Columns = 'SELECT * FROM $SYSTEM.TMSCHEMA_COLUMNS'
    Relationships = 'SELECT * FROM $SYSTEM.TMSCHEMA_RELATIONSHIPS'
}
$sections = New-Object System.Collections.Generic.List[object]
foreach ($entry in $queries.GetEnumerator()) {
    try {
        $data = & (Join-Path $scriptRoot 'Invoke-PowerBILiveDmv.ps1') -Query $entry.Value -Json | ConvertFrom-Json
        $sections.Add([pscustomobject]@{ name = $entry.Key; status = 'Read'; rowCount = @($data.rows).Count; error = $null })
    } catch {
        $sections.Add([pscustomobject]@{ name = $entry.Key; status = 'Unavailable'; rowCount = 0; error = $_.Exception.Message })
    }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.liveVertiPaqAnalyzer.v1'; generated = (Get-Date).ToString('s'); sectionCount = $sections.Count; sections = @($sections.ToArray()); note = 'Uses live DMVs available through Desktop XMLA. Full VertiPaq dictionary/segment detail depends on exposed DMV support.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

