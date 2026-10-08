param([string]$TableName, [string]$DateColumn = 'Date', [int]$ArchiveYears = 5, [int]$RefreshDays = 30, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$policy = [pscustomobject]@{ tableName = $TableName; dateColumn = $DateColumn; archivePeriod = "P$($ArchiveYears)Y"; refreshPeriod = "P$($RefreshDays)D"; requiresRangeParameters = @('RangeStart','RangeEnd') }
$result = [pscustomobject]@{ schema = 'codex.powerbi.incrementalRefreshDraft.v1'; objectType = 'IncrementalRefreshPolicy'; policy = $policy; guidance = 'Create RangeStart/RangeEnd parameters, filter Power Query using them, then configure policy in Desktop or TMDL where supported.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

