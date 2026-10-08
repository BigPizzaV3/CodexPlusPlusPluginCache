param([string]$QueryName = 'NewQuery', [ValidateSet('DateTable','SqlTable','SharePointFile','Blank')] [string]$SourceKind = 'Blank', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$m = switch ($SourceKind) {
    'DateTable' { "let`n    StartDate = #date(2020, 1, 1),`n    EndDate = Date.From(DateTime.LocalNow()),`n    Dates = List.Dates(StartDate, Duration.Days(EndDate - StartDate) + 1, #duration(1,0,0,0)),`n    Table = Table.FromList(Dates, Splitter.SplitByNothing(), {""Date""})`nin`n    Table" }
    'SqlTable' { "let`n    Source = Sql.Database(""server"", ""database""),`n    Table = Source{[Schema=""dbo"",Item=""TableName""]}[Data]`nin`n    Table" }
    'SharePointFile' { "let`n    Source = SharePoint.Files(""https://tenant.sharepoint.com/sites/site"", [ApiVersion = 15])`nin`n    Source" }
    default { "let`n    Source = #table({}, {})`nin`n    Source" }
}
$result = [pscustomobject]@{ schema = 'codex.powerbi.powerQueryDraft.v1'; objectType = 'PowerQuery'; queryName = $QueryName; sourceKind = $SourceKind; mCode = $m; foldingGuidance = 'Check View Native Query where supported and avoid Table.Buffer unless justified.'; gatewayGuidance = 'Confirm credentials and gateway mapping before service refresh.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

