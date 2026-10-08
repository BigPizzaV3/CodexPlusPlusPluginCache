param(
    [string]$Path = ".",
    [string]$OutputPath,
    [switch]$Json,
    [double]$SimilarityThreshold = 0.72
)

$ErrorActionPreference = 'Stop'

if ($SimilarityThreshold -lt 0 -or $SimilarityThreshold -gt 1) {
    throw 'SimilarityThreshold must be between 0 and 1.'
}

$root = (Resolve-Path -LiteralPath $Path).Path
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalogScript = Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1'

function Normalize-MetricName {
    param([string]$Name)

    if (-not $Name) { return '' }
    $normalized = $Name.ToLowerInvariant()
    $normalized = $normalized -replace '[^a-z0-9]+', ' '
    $normalized = $normalized -replace '\b(sum|total|amount|amt|value|val|measure|metric|kpi|calc|calculated)\b', ' '
    $normalized = $normalized -replace '\b(ytd|mtd|qtd|py|ly|cy|fy|rolling|roll|forecast|budget|actual)\b', ' '
    ($normalized -replace '\s+', ' ').Trim()
}

function Get-ExpressionTokens {
    param([string]$Expression)

    if (-not $Expression) { return @() }
    $probe = $Expression.ToLowerInvariant()
    $probe = $probe -replace '"[^"]*"', ' '
    $probe = $probe -replace "'[^']*'", ' '
    $probe = $probe -replace '\[[^\]]+\]', ' '
    $tokens = [regex]::Matches($probe, '[a-z_][a-z0-9_]*') | ForEach-Object { $_.Value }
    $stop = @{
        'var' = $true; 'return' = $true; 'if' = $true; 'true' = $true; 'false' = $true; 'blank' = $true
        'calculate' = $true; 'filter' = $true; 'all' = $true; 'values' = $true; 'sum' = $true
        'divide' = $true; 'and' = $true; 'or' = $true; 'not' = $true
    }
    @($tokens | Where-Object { -not $stop.ContainsKey($_) } | Sort-Object -Unique)
}

function Get-JaccardScore {
    param([string[]]$Left, [string[]]$Right)

    $leftSet = @{}
    foreach ($item in @($Left)) {
        if ($item) { $leftSet[$item] = $true }
    }
    $rightSet = @{}
    foreach ($item in @($Right)) {
        if ($item) { $rightSet[$item] = $true }
    }
    $union = @{}
    foreach ($key in $leftSet.Keys) { $union[$key] = $true }
    foreach ($key in $rightSet.Keys) { $union[$key] = $true }
    if ($union.Count -eq 0) { return 0.0 }
    $intersection = 0
    foreach ($key in $leftSet.Keys) {
        if ($rightSet.ContainsKey($key)) { $intersection++ }
    }
    [math]::Round($intersection / [double]$union.Count, 4)
}

function Get-NameScore {
    param([string]$Left, [string]$Right)

    if (-not $Left -or -not $Right) { return 0.0 }
    if ($Left -eq $Right) { return 1.0 }
    $leftTokens = @($Left -split '\s+' | Where-Object { $_ })
    $rightTokens = @($Right -split '\s+' | Where-Object { $_ })
    Get-JaccardScore -Left $leftTokens -Right $rightTokens
}

function Get-CanonicalRecommendation {
    param([object[]]$Metrics)

    $ranked = @($Metrics | Sort-Object `
        @{ Expression = { @($_.risks).Count }; Ascending = $true }, `
        @{ Expression = { $_.expressionLength }; Ascending = $true }, `
        @{ Expression = { $_.name }; Ascending = $true })
    $winner = $ranked | Select-Object -First 1
    [pscustomobject]@{
        metricId = $winner.id
        name = $winner.name
        table = $winner.table
        rationale = 'Prefer the candidate with fewer catalog risks, shorter expression, and stable naming as the canonical metric.'
    }
}

$catalog = & $catalogScript -Path $root -Json | ConvertFrom-Json
if (@($catalog.metrics).Count -eq 0) {
    $liveCatalogPath = Join-Path $root 'live-metric-catalog.json'
    if (Test-Path -LiteralPath $liveCatalogPath) {
        $liveCatalog = Get-Content -Raw -LiteralPath $liveCatalogPath | ConvertFrom-Json
        $catalog = [pscustomobject]@{
            schema = 'codex.powerbi.metricCatalog.liveCatalogFallback.v1'
            root = $root
            metricCount = @($liveCatalog.metrics).Count
            metrics = @($liveCatalog.metrics | ForEach-Object {
                [pscustomobject]@{
                    id = $_.id
                    name = $_.name
                    table = $_.table
                    source = $_.source
                    expression = $_.expression
                    risks = @($_.risks)
                }
            })
        }
    }
}
$metrics = @($catalog.metrics | ForEach-Object {
    $normalizedName = Normalize-MetricName -Name $_.name
    $tokens = @(Get-ExpressionTokens -Expression $_.expression)
    [pscustomobject]@{
        id = $_.id
        name = $_.name
        table = $_.table
        source = $_.source
        expression = $_.expression
        expressionLength = if ($_.expression) { $_.expression.Length } else { 0 }
        risks = @($_.risks)
        normalizedName = $normalizedName
        expressionTokens = $tokens
    }
})

$edges = New-Object System.Collections.Generic.List[object]
for ($i = 0; $i -lt $metrics.Count; $i++) {
    for ($j = $i + 1; $j -lt $metrics.Count; $j++) {
        $left = $metrics[$i]
        $right = $metrics[$j]
        $nameScore = Get-NameScore -Left $left.normalizedName -Right $right.normalizedName
        $tokenScore = Get-JaccardScore -Left $left.expressionTokens -Right $right.expressionTokens
        $combined = [math]::Round([math]::Min(1.0, [math]::Max(0.0, (($nameScore * 0.45) + ($tokenScore * 0.55)))), 4)
        $exactExpression = ($left.expression -and $right.expression -and (($left.expression -replace '\s+', ' ').Trim() -eq ($right.expression -replace '\s+', ' ').Trim()))
        if ($combined -ge $SimilarityThreshold -or ($exactExpression -and $tokenScore -ge 0.5)) {
            $edges.Add([pscustomobject]@{
                leftId = $left.id
                rightId = $right.id
                score = if ($exactExpression) { [math]::Max($combined, 0.98) } else { $combined }
                nameScore = $nameScore
                expressionTokenScore = $tokenScore
                reason = if ($exactExpression) { 'Exact normalized expression match' } elseif ($nameScore -ge $tokenScore) { 'Similar normalized metric names' } else { 'Similar expression token profile' }
            })
        }
    }
}

$parent = @{}
foreach ($metric in $metrics) { $parent[$metric.id] = $metric.id }

function Find-Parent {
    param([hashtable]$Parent, [string]$Id)

    while ($Parent[$Id] -ne $Id) {
        $Parent[$Id] = $Parent[$Parent[$Id]]
        $Id = $Parent[$Id]
    }
    $Id
}

foreach ($edge in $edges) {
    $leftRoot = Find-Parent -Parent $parent -Id $edge.leftId
    $rightRoot = Find-Parent -Parent $parent -Id $edge.rightId
    if ($leftRoot -ne $rightRoot) { $parent[$rightRoot] = $leftRoot }
}

$groupsByRoot = @{}
foreach ($metric in $metrics) {
    $rootId = Find-Parent -Parent $parent -Id $metric.id
    if (-not $groupsByRoot.ContainsKey($rootId)) { $groupsByRoot[$rootId] = New-Object System.Collections.Generic.List[object] }
    $groupsByRoot[$rootId].Add($metric)
}

$duplicateGroups = foreach ($key in @($groupsByRoot.Keys)) {
    $keyText = [string]$key
    $members = @($groupsByRoot[$keyText].ToArray())
    if ($members.Count -lt 2) { continue }
    $memberIds = @($members | ForEach-Object { $_.id })
    $groupEdges = @($edges | Where-Object { $memberIds -contains $_.leftId -and $memberIds -contains $_.rightId } | Sort-Object -Property score -Descending)
    $maxScore = if ($groupEdges.Count) { ($groupEdges | Select-Object -First 1).score } else { 0 }
    [pscustomobject]@{
        groupId = ('duplicate-{0}' -f (($members | Select-Object -First 1).normalizedName -replace '[^a-z0-9]+', '-').Trim('-'))
        risk = if ($maxScore -ge 0.9) { 'High' } elseif ($maxScore -ge 0.78) { 'Medium' } else { 'Low' }
        reviewRequired = $true
        maxSimilarity = $maxScore
        canonicalRecommendation = Get-CanonicalRecommendation -Metrics $members
        members = @($members | Sort-Object name | ForEach-Object {
            [pscustomobject]@{
                id = $_.id
                name = $_.name
                table = $_.table
                source = $_.source
                normalizedName = $_.normalizedName
                expressionTokenCount = @($_.expressionTokens).Count
                riskCount = @($_.risks).Count
            }
        })
        evidence = @($groupEdges)
    }
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.metricDuplicates.v1'
    root = $root
    generated = (Get-Date).ToString('s')
    similarityThreshold = $SimilarityThreshold
    metricCount = $metrics.Count
    duplicateGroupCount = @($duplicateGroups).Count
    duplicateGroups = @($duplicateGroups | Sort-Object @{ Expression = { $_.risk }; Descending = $false }, groupId)
}

if ($Json) {
    $text = $result | ConvertTo-Json -Depth 10
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }
    $text
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Metric Duplicate Candidates')
$lines.Add('')
$lines.Add(('Schema: `{0}`' -f $result.schema))
$lines.Add(('Root: `{0}`' -f $result.root))
$lines.Add(('Generated: {0}' -f $result.generated))
$lines.Add(('Metrics scanned: {0}' -f $result.metricCount))
$lines.Add(('Duplicate groups: {0}' -f $result.duplicateGroupCount))
$lines.Add('')
if ($result.duplicateGroupCount -eq 0) {
    $lines.Add('No duplicate candidates met the configured similarity threshold.')
}
foreach ($group in $result.duplicateGroups) {
    $lines.Add(('## {0}' -f $group.groupId))
    $lines.Add('')
    $lines.Add(('- Risk: {0}' -f $group.risk))
    $lines.Add(('- Review required: {0}' -f $group.reviewRequired))
    $lines.Add(('- Max similarity: {0}' -f $group.maxSimilarity))
    $lines.Add(('- Canonical recommendation: {0} ({1})' -f $group.canonicalRecommendation.name, $group.canonicalRecommendation.rationale))
    $lines.Add('')
    foreach ($member in $group.members) {
        $lines.Add(('- `{0}` from `{1}` (tokens: {2}, risks: {3})' -f $member.name, $member.source, $member.expressionTokenCount, $member.riskCount))
    }
    $lines.Add('')
}

$markdown = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8 }
$markdown
