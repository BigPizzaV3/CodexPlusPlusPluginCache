param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Path).Path

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    if ([System.IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    $baseUri = [Uri]((Join-Path $BasePath '.') + [System.IO.Path]::DirectorySeparatorChar)
    $targetUri = [Uri]$TargetPath
    [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Get-DaxMeasureBlocks {
    param([string]$Text, [string]$RelativePath)

    $pattern = '(?ms)^\s*(?:MEASURE\s+)?(?:(?<table>''[^'']+''|\w+)\s*)?\[(?<name>[^\]\r\n=]+)\]\s*=\s*(?<expr>.*?)(?=^\s*(?:MEASURE\s+)?(?:(?:''[^'']+''|\w+)\s*)?\[[^\]\r\n=]+\]\s*=|\z)'
    foreach ($match in [regex]::Matches($Text, $pattern)) {
        $name = ($match.Groups['name'].Value).Trim()
        $expr = ($match.Groups['expr'].Value).Trim()
        if ($name -and $expr) {
            [pscustomobject]@{
                Name = $name
                Table = ($match.Groups['table'].Value).Trim("' ")
                Expression = $expr
                Source = $RelativePath
            }
        }
    }
}

function Get-MetricTags {
    param([string]$Name, [string]$Expression)

    $tags = New-Object System.Collections.Generic.List[string]
    $probe = "$Name $Expression"
    if ($probe -match '(?i)sales|revenue|amount|margin|profit') { $tags.Add('finance') }
    if ($probe -match '(?i)yoy|prior year|previous year|sameperiodlastyear') { $tags.Add('time-intelligence') }
    if ($probe -match '(?i)customer|account|active') { $tags.Add('customer') }
    if ($probe -match '(?i)divide\s*\(') { $tags.Add('ratio') }
    if ($probe -match '(?i)count|distinctcount') { $tags.Add('counting') }
    if ($tags.Count -eq 0) { $tags.Add('uncategorized') }
    $tags
}

function Get-MetricRisks {
    param([string]$Expression)

    $risks = New-Object System.Collections.Generic.List[string]
    if ($Expression -match '(?i)\bFILTER\s*\(\s*ALL\s*\(') { $risks.Add('performance: FILTER over ALL') }
    if ($Expression -match '(?i)\bTODAY\s*\(|\bNOW\s*\(') { $risks.Add('determinism: volatile date/time') }
    if ($Expression -match '(?i)\bEARLIER\s*\(') { $risks.Add('maintainability: EARLIER') }
    if ($Expression -match '(?i)\bUSERELATIONSHIP\s*\(') { $risks.Add('semantics: inactive relationship') }
    if (($Expression -split "`r?`n").Count -gt 20) { $risks.Add('maintainability: long expression') }
    $risks
}

$measureFiles = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension.ToLowerInvariant() -in @('.dax', '.tmdl') } |
    Sort-Object FullName

$metrics = foreach ($file in $measureFiles) {
    $relative = Get-RelativePath -BasePath $root -TargetPath $file.FullName
    $text = Get-Content -Raw -LiteralPath $file.FullName
    Get-DaxMeasureBlocks -Text $text -RelativePath $relative | ForEach-Object {
        $risks = @(Get-MetricRisks -Expression $_.Expression)
        [pscustomobject]@{
            id = (($_.Table + '.' + $_.Name).Trim('.')).ToLowerInvariant().Replace(' ', '-').Replace('%', 'pct')
            name = $_.Name
            table = $_.Table
            source = $_.Source
            tags = @(Get-MetricTags -Name $_.Name -Expression $_.Expression)
            riskLevel = if ($risks.Count -gt 0) { 'review' } else { 'normal' }
            risks = $risks
            owner = '[TODO: metric owner]'
            businessDefinition = '[TODO: business definition]'
            validationQuestion = ('Does `{0}` reconcile to the accepted business source for the selected filter context?' -f $_.Name)
            expression = $_.Expression
        }
    }
}

$catalog = [pscustomobject]@{
    schema = 'codex.powerbi.metricCatalog.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    metricCount = @($metrics).Count
    metrics = @($metrics)
}

if ($Json) {
    $jsonText = $catalog | ConvertTo-Json -Depth 8
    if ($OutputPath) {
        Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8
    }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Metric Catalog')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $catalog.schema))
$lines.Add(('Root: `{0}`' -f $catalog.root))
$lines.Add(('Generated: {0}' -f $catalog.generated))
$lines.Add(('Metrics: {0}' -f $catalog.metricCount))
$lines.Add('')
foreach ($metric in $catalog.metrics) {
    $title = if ($metric.table) { "$($metric.table)[$($metric.name)]" } else { $metric.name }
    $lines.Add(('## {0}' -f $title))
    $lines.Add('')
    $lines.Add(('- ID: `{0}`' -f $metric.id))
    $lines.Add(('- Source: `{0}`' -f $metric.source))
    $lines.Add(('- Tags: {0}' -f ($metric.tags -join ', ')))
    $lines.Add(('- Risk level: {0}' -f $metric.riskLevel))
    if ($metric.risks.Count -gt 0) {
        $lines.Add(('- Risks: {0}' -f ($metric.risks -join '; ')))
    }
    $lines.Add(('- Owner: {0}' -f $metric.owner))
    $lines.Add(('- Business definition: {0}' -f $metric.businessDefinition))
    $lines.Add(('- Validation question: {0}' -f $metric.validationQuestion))
    $lines.Add('')
    $lines.Add('```DAX')
    $lines.Add($metric.expression)
    $lines.Add('```')
    $lines.Add('')
}

$markdown = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8
}
$markdown
