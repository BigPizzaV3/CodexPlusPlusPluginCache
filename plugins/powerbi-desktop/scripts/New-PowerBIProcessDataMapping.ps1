param(
    [string]$Path = ".",
    [string]$DataPath,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Split-Path -Parent $scriptRoot
$rulesRoot = Join-Path $pluginRoot 'rules/process-packs'
$root = (Resolve-Path -LiteralPath $Path).Path
$resolvedData = if ($DataPath -and (Test-Path -LiteralPath $DataPath)) { (Resolve-Path -LiteralPath $DataPath).Path } else { $null }

function Get-FieldAliases {
    param([object]$Field)
    @($Field.name, $Field.aliases) | Where-Object { $_ } | ForEach-Object { $_.ToString() }
}

function Get-TableRows {
    param([string]$Folder)
    if (-not $Folder) { return @() }
    Get-ChildItem -LiteralPath $Folder -File -Include *.csv,*.json -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $rows = @()
        try {
            if ($_.Extension -ieq '.csv') { $rows = @(Import-Csv -LiteralPath $_.FullName) }
            elseif ($_.Extension -ieq '.json') {
                $raw = Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json
                $rows = if ($raw -is [array]) { @($raw) } elseif ($raw.rows) { @($raw.rows) } else { @($raw) }
            }
        }
        catch { $rows = @() }
        $columns = @()
        if ($rows.Count -gt 0) { $columns = @($rows[0].PSObject.Properties.Name) }
        [pscustomobject]@{ name = $_.BaseName; path = $_.FullName; rowCount = $rows.Count; columns = $columns }
    }
}

function Get-ModelTables {
    param([string]$Folder)
    $files = @(Get-ChildItem -LiteralPath $Folder -Recurse -File -Include *.tmdl,*.dax,*.pq,*.json -ErrorAction SilentlyContinue)
    $tables = [ordered]@{}
    foreach ($file in $files) {
        $text = ''
        try { $text = Get-Content -Raw -LiteralPath $file.FullName } catch { continue }
        foreach ($match in [regex]::Matches($text, "(?im)\btable\s+'?([^'\r\n{]+)'?")) {
            $name = $match.Groups[1].Value.Trim()
            if (-not $tables.Contains($name)) { $tables[$name] = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase) }
        }
        foreach ($match in [regex]::Matches($text, "(?im)'?([A-Za-z][A-Za-z0-9 _-]+)'?\[([A-Za-z][A-Za-z0-9 _-]+)\]")) {
            $table = $match.Groups[1].Value.Trim()
            $column = $match.Groups[2].Value.Trim()
            if (-not $tables.Contains($table)) { $tables[$table] = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase) }
            [void]$tables[$table].Add($column)
        }
    }
    foreach ($key in $tables.Keys) {
        [pscustomobject]@{ name = $key; path = $null; rowCount = 0; columns = @($tables[$key]) }
    }
}

function Find-BestTable {
    param([object]$ObjectDefinition, [object[]]$Tables)
    $terms = @($ObjectDefinition.name, $ObjectDefinition.aliases) | Where-Object { $_ }
    $best = $null
    $bestScore = 0
    foreach ($table in $Tables) {
        $name = $table.name.ToString()
        $score = 0
        foreach ($term in $terms) {
            $t = $term.ToString()
            if ($name -ieq $t) { $score += 100 }
            elseif ($name -match [regex]::Escape($t)) { $score += 40 }
            elseif ($t -match [regex]::Escape($name)) { $score += 20 }
        }
        if ($score -gt $bestScore) { $best = $table; $bestScore = $score }
    }
    if ($bestScore -gt 0) { $best } else { $null }
}

function Find-BestField {
    param([object]$FieldDefinition, [string[]]$Columns)
    foreach ($alias in (Get-FieldAliases -Field $FieldDefinition)) {
        $exact = @($Columns | Where-Object { $_ -ieq $alias } | Select-Object -First 1)
        if ($exact) { return $exact[0] }
    }
    foreach ($alias in (Get-FieldAliases -Field $FieldDefinition)) {
        $hit = @($Columns | Where-Object { $_ -match [regex]::Escape($alias) -or $alias -match [regex]::Escape($_) } | Select-Object -First 1)
        if ($hit) { return $hit[0] }
    }
    $null
}

$exportTables = @(Get-TableRows -Folder $resolvedData)
$modelTables = @(Get-ModelTables -Folder $root)
$allTables = @($exportTables + $modelTables)
$packs = @(Get-ChildItem -LiteralPath $rulesRoot -File -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json })
$mappings = foreach ($pack in $packs) {
    foreach ($object in @($pack.objects)) {
        $table = Find-BestTable -ObjectDefinition $object -Tables $allTables
        $fields = foreach ($field in @($object.fields)) {
            $mapped = if ($table) { Find-BestField -FieldDefinition $field -Columns @($table.columns) } else { $null }
            [pscustomobject]@{
                name = $field.name
                required = [bool]$field.required
                mappedField = $mapped
                status = if ($mapped) { 'Mapped' } elseif ($field.required) { 'MissingRequiredField' } else { 'MissingOptionalField' }
                aliases = @(Get-FieldAliases -Field $field)
            }
        }
        [pscustomobject]@{
            process = $pack.process
            object = $object.name
            mappedTable = if ($table) { $table.name } else { $null }
            tablePath = if ($table) { $table.path } else { $null }
            rowCount = if ($table) { $table.rowCount } else { 0 }
            sourceType = if ($table -and $table.path) { 'Export' } elseif ($table) { 'PowerBIModel' } else { 'NotMapped' }
            status = if (-not $table) { 'MissingObject' } elseif (@($fields | Where-Object { $_.status -eq 'MissingRequiredField' }).Count -gt 0) { 'NeedsMapping' } else { 'Mapped' }
            fields = @($fields)
        }
    }
}

$mappedCount = @($mappings | Where-Object { $_.status -eq 'Mapped' }).Count
$needsMappingCount = @($mappings | Where-Object { $_.status -ne 'Mapped' }).Count
$result = [pscustomobject]@{
    schema = 'codex.powerbi.processDataMapping.v1'
    generated = (Get-Date).ToString('s')
    source = $root
    dataPath = $resolvedData
    status = if ($needsMappingCount -gt 0) { 'NeedsMapping' } else { 'Mapped' }
    processCount = @($packs).Count
    mappedObjectCount = $mappedCount
    needsMappingCount = $needsMappingCount
    mappings = @($mappings)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 12
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = @('# Power BI Process Data Mapping', '', "Status: $($result.status)", "Mapped objects: $mappedCount", "Needs mapping: $needsMappingCount", '')
$lines += @($mappings | ForEach-Object { "- [$($_.status)] $($_.process) / $($_.object): $($_.mappedTable)" })
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
