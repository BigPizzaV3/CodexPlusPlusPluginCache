param(
    [string]$JournalPath = '.\powerbi-ai-change-journal.json',
    [string]$Title,
    [ValidateSet('proposed','accepted','rejected','applied','verified')]
    [string]$Status = 'proposed',
    [string]$Rationale = '',
    [string]$Artifact = '',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$entries = @()
if (Test-Path -LiteralPath $JournalPath) {
    $existing = Get-Content -Raw -LiteralPath $JournalPath | ConvertFrom-Json
    $entries = @($existing.entries)
}

$entry = [pscustomobject]@{
    id = [guid]::NewGuid().ToString('n')
    timestamp = (Get-Date).ToString('s')
    title = if ($Title) { $Title } else { '[untitled change]' }
    status = $Status
    rationale = $Rationale
    artifact = $Artifact
}
$entries = @($entries + $entry)

$journal = [pscustomobject]@{
    schema = 'codex.powerbi.changeJournal.v1'
    updated = (Get-Date).ToString('s')
    journalPath = $JournalPath
    entryCount = $entries.Count
    entries = $entries
}

$journal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $JournalPath -Encoding UTF8
if ($OutputPath) { $journal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8 }
if ($Json) { $journal | ConvertTo-Json -Depth 8; return }

$lines = @('# AI Change Journal', '', "Entries: $($entries.Count)", '', '## Latest Entry', "- [$Status] $($entry.title)", $entry.rationale)
($lines -join [Environment]::NewLine) + [Environment]::NewLine
