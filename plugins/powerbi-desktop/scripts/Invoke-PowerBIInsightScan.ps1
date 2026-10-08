param(
    [string]$Path = ".",
    [string]$OutputPath,
    [string]$RulesPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Path).Path
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $RulesPath) {
    $RulesPath = Join-Path (Split-Path -Parent $scriptRoot) 'rules/powerbi-governance-rules.json'
}
$rules = if (Test-Path -LiteralPath $RulesPath) {
    Get-Content -Raw -LiteralPath $RulesPath | ConvertFrom-Json
}
else {
    [pscustomobject]@{
        dax = @()
        powerQuery = @()
        thresholds = [pscustomobject]@{ longMeasureLines = 20; highRiskScore = 9; mediumRiskScore = 4 }
    }
}

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)
    if ([System.IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }
    $baseUri = [Uri]((Join-Path $BasePath '.') + [System.IO.Path]::DirectorySeparatorChar)
    $targetUri = [Uri]$TargetPath
    [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Read-TextFile {
    param([string]$FilePath)
    Get-Content -Raw -LiteralPath $FilePath
}

function Add-Finding {
    param(
        [System.Collections.Generic.List[object]]$Findings,
        [string]$Severity,
        [string]$Category,
        [string]$Title,
        [string]$Detail,
        [string]$Source
    )

    $score = switch ($Severity) {
        'High' { 3 }
        'Medium' { 2 }
        'Low' { 1 }
        default { 0 }
    }

    $Findings.Add([pscustomobject]@{
        Severity = $Severity
        Score = $score
        Category = $Category
        Title = $Title
        Detail = $Detail
        Source = $Source
    })
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
                Table = ($match.Groups['table'].Value).Trim()
                Expression = $expr
                Source = $RelativePath
            }
        }
    }
}

function Invoke-TextRules {
    param(
        [object[]]$Rules,
        [string]$Text,
        [string]$Source,
        [System.Collections.Generic.List[object]]$Findings
    )

    foreach ($rule in @($Rules)) {
        if ($false -eq $rule.enabled) {
            continue
        }
        if ($Text -match "(?i)$($rule.pattern)") {
            Add-Finding -Findings $Findings -Severity $rule.severity -Category $rule.category -Title $rule.title -Detail $rule.detail -Source $Source
        }
    }
}

$allFiles = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName
$powerBiFiles = $allFiles | Where-Object { $_.Extension.ToLowerInvariant() -in @('.pbix', '.pbit', '.pbip', '.pbism', '.bim', '.tmdl', '.dax', '.pq', '.json') }
$findings = New-Object System.Collections.Generic.List[object]
$measures = New-Object System.Collections.Generic.List[object]
$queries = New-Object System.Collections.Generic.List[object]
$tmdlObjects = New-Object System.Collections.Generic.List[object]

foreach ($file in $powerBiFiles) {
    $relative = Get-RelativePath -BasePath $root -TargetPath $file.FullName
    $extension = $file.Extension.ToLowerInvariant()

    if ($extension -in @('.pbix', '.pbit')) {
        Add-Finding -Findings $findings -Severity 'Medium' -Category 'Source Control' -Title 'Binary report file' -Detail 'Binary PBIX/PBIT files limit transparent review and diff quality. Prefer PBIP export for governed changes.' -Source $relative
        continue
    }

    if ($extension -notin @('.dax', '.tmdl', '.pq', '.bim', '.json', '.pbism')) {
        continue
    }

    $text = Read-TextFile -FilePath $file.FullName

    if ($extension -in @('.dax', '.tmdl')) {
        Get-DaxMeasureBlocks -Text $text -RelativePath $relative | ForEach-Object {
            $measures.Add($_)
            $expr = $_.Expression
            Invoke-TextRules -Rules @($rules.dax) -Text $expr -Source $relative -Findings $findings
            if (($expr -split "`r?`n").Count -gt $rules.thresholds.longMeasureLines) {
                Add-Finding -Findings $findings -Severity 'Low' -Category 'DAX Maintainability' -Title 'Long measure expression' -Detail 'Long measures are harder to review and test. Consider variables, helper measures, or business-rule documentation.' -Source $relative
            }
        }
    }

    if ($extension -eq '.pq') {
        $queries.Add([pscustomobject]@{
            Name = [System.IO.Path]::GetFileNameWithoutExtension($relative)
            Source = $relative
            Lines = ($text -split "`r?`n").Count
        })
        Invoke-TextRules -Rules @($rules.powerQuery) -Text $text -Source $relative -Findings $findings
        if ($text -match '(?i)Web\.Contents\s*\(' -and $text -notmatch '(?i)RelativePath') {
            Add-Finding -Findings $findings -Severity 'Low' -Category 'Power Query Maintainability' -Title 'Web.Contents without RelativePath' -Detail 'Using RelativePath and Query options often improves gateway compatibility and credential scoping.' -Source $relative
        }
    }

    if ($extension -eq '.tmdl') {
        foreach ($match in [regex]::Matches($text, '(?m)^\s*(table|column|measure|relationship|partition|calculationGroup)\s+(.+?)\s*$')) {
            $tmdlObjects.Add([pscustomobject]@{
                Kind = $match.Groups[1].Value
                Name = $match.Groups[2].Value.Trim()
                Source = $relative
            })
        }
    }
}

$hasPbip = @($powerBiFiles | Where-Object { $_.Extension.ToLowerInvariant() -eq '.pbip' }).Count -gt 0
$hasTextModel = @($powerBiFiles | Where-Object { $_.Extension.ToLowerInvariant() -in @('.tmdl', '.bim', '.dax', '.pq') }).Count -gt 0
if (-not $hasTextModel) {
    Add-Finding -Findings $findings -Severity 'High' -Category 'Inspectability' -Title 'No text-based model artifacts' -Detail 'Codex can inventory binary files, but deep semantic review needs PBIP, TMDL, model.bim, DAX, or Power Query exports.' -Source '.'
}
if (-not $hasPbip -and $hasTextModel) {
    Add-Finding -Findings $findings -Severity 'Low' -Category 'Project Format' -Title 'Text artifacts without PBIP file' -Detail 'A PBIP entry point improves Power BI Desktop round-tripping and source-control structure.' -Source '.'
}

$riskScore = ($findings | Measure-Object -Property Score -Sum).Sum
if (-not $riskScore) { $riskScore = 0 }
$riskLevel = if ($riskScore -ge $rules.thresholds.highRiskScore) { 'High' } elseif ($riskScore -ge $rules.thresholds.mediumRiskScore) { 'Medium' } else { 'Low' }

$result = [pscustomobject]@{
    Root = $root
    Generated = (Get-Date).ToString('s')
    RiskLevel = $riskLevel
    RiskScore = $riskScore
    FileCount = @($powerBiFiles).Count
    MeasureCount = $measures.Count
    QueryCount = $queries.Count
    TmdlObjectCount = $tmdlObjects.Count
    RulesPath = $RulesPath
    Findings = $findings | Sort-Object Score, Category, Title -Descending
    Measures = $measures
    Queries = $queries
    TmdlObjects = $tmdlObjects
    RecommendedNextActions = @(
        'Export PBIX/PBIT assets to PBIP before structural edits.',
        'Generate a model summary and attach it to the report documentation.',
        'Review high and medium findings before optimizing visuals or adding features.',
        'Use Tabular Editor Best Practice Analyzer when available.'
    )
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) {
        Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8
    }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Insight Scan')
$lines.Add('')
$lines.Add(('Root: `{0}`' -f $result.Root))
$lines.Add(('Generated: {0}' -f $result.Generated))
$lines.Add('')
$lines.Add('## Executive Signal')
$lines.Add('')
$lines.Add(('- Risk level: **{0}**' -f $result.RiskLevel))
$lines.Add(('- Risk score: **{0}**' -f $result.RiskScore))
$lines.Add(('- Power BI files: {0}' -f $result.FileCount))
$lines.Add(('- Measures detected: {0}' -f $result.MeasureCount))
$lines.Add(('- Power Query files detected: {0}' -f $result.QueryCount))
$lines.Add(('- TMDL objects detected: {0}' -f $result.TmdlObjectCount))
$lines.Add('')
$lines.Add('## Findings')
$lines.Add('')
if ($findings.Count -gt 0) {
    foreach ($finding in $result.Findings) {
        $lines.Add(('### [{0}] {1}' -f $finding.Severity, $finding.Title))
        $lines.Add('')
        $lines.Add(('- Category: {0}' -f $finding.Category))
        $lines.Add(('- Source: `{0}`' -f $finding.Source))
        $lines.Add(('- Detail: {0}' -f $finding.Detail))
        $lines.Add('')
    }
}
else {
    $lines.Add('No findings detected by local heuristics.')
    $lines.Add('')
}
$lines.Add('## Recommended Next Actions')
$lines.Add('')
foreach ($action in $result.RecommendedNextActions) {
    $lines.Add(('- {0}' -f $action))
}

$markdown = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $markdown -Encoding UTF8
}
$markdown
