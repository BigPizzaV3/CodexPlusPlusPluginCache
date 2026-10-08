param([string]$DetailTable, [string]$AggregationTable, [string[]]$GroupByColumns = @(), [string[]]$SumColumns = @(), [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$mappings = @($GroupByColumns | ForEach-Object { [pscustomobject]@{ aggregationColumn = $_; detailColumn = $_; summarization = 'GroupBy' } }) + @($SumColumns | ForEach-Object { [pscustomobject]@{ aggregationColumn = $_; detailColumn = $_; summarization = 'Sum' } })
$result = [pscustomobject]@{ schema = 'codex.powerbi.aggregationDraft.v1'; objectType = 'AggregationTable'; detailTable = $DetailTable; aggregationTable = $AggregationTable; mappings = @($mappings); validation = 'Validate aggregation hits with Performance Analyzer and DAX queries after applying.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

