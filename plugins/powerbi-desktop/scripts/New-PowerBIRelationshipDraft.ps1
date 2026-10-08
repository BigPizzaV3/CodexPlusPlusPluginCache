param([string]$FromTable, [string]$FromColumn, [string]$ToTable, [string]$ToColumn, [string]$Cardinality = 'manyToOne', [string]$CrossFilteringBehavior = 'oneDirection', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$name = ('{0}_{1}_to_{2}_{3}' -f $FromTable,$FromColumn,$ToTable,$ToColumn) -replace '[^A-Za-z0-9_]', '_'
$tmdl = "relationship $name`n    fromColumn: $FromTable.$FromColumn`n    toColumn: $ToTable.$ToColumn`n    cardinality: $Cardinality`n    crossFilteringBehavior: $CrossFilteringBehavior"
$result = [pscustomobject]@{ schema = 'codex.powerbi.relationshipDraft.v1'; objectType = 'Relationship'; relationshipName = $name; from = "$FromTable[$FromColumn]"; to = "$ToTable[$ToColumn]"; cardinality = $Cardinality; crossFilteringBehavior = $CrossFilteringBehavior; tmdl = $tmdl; safety = 'Draft only. Validate ambiguity and filter direction before applying.' }
if ($Json) { $text = $result | ConvertTo-Json -Depth 6; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result

