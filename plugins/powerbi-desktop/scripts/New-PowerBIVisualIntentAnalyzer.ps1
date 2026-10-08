param([string]$Path='.', [string]$OutputPath, [switch]$Json)
$ErrorActionPreference='Stop'

function New-Finding {
    param([string]$Severity, [string]$Category, [string]$Title, [string]$Detail, [string]$Source = $null)
    [pscustomobject]@{ severity = $Severity; category = $Category; title = $Title; detail = $Detail; source = $Source }
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

function Get-ReportJsonText {
    param([string]$Root)
    Get-ChildItem -LiteralPath $Root -Recurse -File -Include *.json -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '(?i)(Report|report|definition|pages|visual)' } |
        ForEach-Object {
            [pscustomobject]@{ source = Get-RelativePath -BasePath $Root -TargetPath $_.FullName; text = (Get-Content -Raw -LiteralPath $_.FullName) }
        }
}

function Get-VisualTypeFromText {
    param([string]$Text)
    $match = [regex]::Match($Text, '"visualType"\s*:\s*"(?<type>[^"]+)"')
    if ($match.Success) { return $match.Groups['type'].Value }
    'Unknown'
}

$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$resolved=(Resolve-Path -LiteralPath $Path).Path
$blueprint=&(Join-Path $scriptRoot 'New-PowerBIReportBlueprint.ps1') -Path $Path -Json|ConvertFrom-Json
$impact=&(Join-Path $scriptRoot 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $Path -Json|ConvertFrom-Json
$catalog=&(Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json|ConvertFrom-Json
$reportJson=@(Get-ReportJsonText -Root $resolved)
$reportText=($reportJson|ForEach-Object{$_.text}) -join [Environment]::NewLine
$findings=New-Object System.Collections.Generic.List[object]

$riskyVisualTypes=@('card','multiRowCard','gauge','pieChart','donutChart','treemap')
$visualTypeCounts=@{}
foreach($record in $reportJson){
    $type=Get-VisualTypeFromText -Text $record.text
    if(-not $visualTypeCounts.ContainsKey($type)){ $visualTypeCounts[$type]=0 }
    $visualTypeCounts[$type]++
    if($riskyVisualTypes -contains $type){
        $findings.Add((New-Finding -Severity 'Medium' -Category 'Risky Visual' -Title "Review $type visual" -Detail 'This visual type can hide distribution, trend, or comparison context. Verify labels, tooltips, and companion trend/detail visuals.' -Source $record.source))
    }
    if($record.text -match '(?i)"filter"|"slicer"|"interactions"'){
        $findings.Add((New-Finding -Severity 'Low' -Category 'Filter Context' -Title 'Filter context metadata detected' -Detail 'Validate that slicers, visual-level filters, and cross-filter interactions preserve the intended business question.' -Source $record.source))
    }
}

foreach($metric in @($catalog.metrics)){
    $isReferenced = $false
    if($reportText){ $isReferenced = $reportText -match [regex]::Escape($metric.name) }
    if(-not $isReferenced){
        $findings.Add((New-Finding -Severity 'Low' -Category 'Missing Measure' -Title "Measure not found in visual metadata: $($metric.name)" -Detail 'The measure exists in the semantic model but was not detected in report JSON. Confirm whether this is unused, hidden behind field parameters, or missing from the report surface.' -Source $metric.source))
    }
}

$intents=foreach($page in @($blueprint.pages)){
    $measureNames=@($page.measures)
    [pscustomobject]@{
        page=$page.name
        intendedDecision=$(if($page.purpose){$page.purpose}else{$page.goal})
        primaryMeasures=$measureNames
        visualTypes=@($visualTypeCounts.Keys | Sort-Object)
        contradictionRisk=$(if($measureNames.Count -gt 5){'Medium'}else{'Low'})
        redundancyRisk=$(if(@($impact.impacts|Where-Object detectedVisualReferences -gt 3).Count -gt 0){'Medium'}else{'Low'})
        filterContextHint='Confirm page, visual, tooltip, and drillthrough filters match the stated page decision.'
        recommendedNarrative=('Use the page to answer: {0}' -f $(if($page.purpose){$page.purpose}else{$page.goal}))
    }
}

$lineage=@($impact.impacts|Where-Object detectedVisualReferences -gt 0|ForEach-Object{
    [pscustomobject]@{measure=$_.measure; references=$_.detectedVisualReferences; affectedVisuals=@($_.affectedVisuals)}
})
$result=[pscustomobject]@{
    schema='codex.powerbi.visualIntentAnalyzer.v1'
    root=$resolved
    generated=(Get-Date).ToString('s')
    reportMetadataStatus=$impact.reportMetadataStatus
    pageCount=@($intents).Count
    visualCount=$impact.visualCount
    findingCount=$findings.Count
    findings=@($findings.ToArray())
    visualMeasureLineage=$lineage
    intents=@($intents)
}
if($Json){$text=$result|ConvertTo-Json -Depth 12;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8};$text;return}
$md=@('# Power BI Visual Intent Analyzer','',"Report metadata: $($result.reportMetadataStatus)","Findings: $($result.findingCount)",'')
$md+=@('## Findings')+@($result.findings|ForEach-Object{"- [$($_.severity)] $($_.category): $($_.title) - $($_.detail)"})
$md+=@('','## Intents')+@($intents|ForEach-Object{"### $($_.page)`n- Decision: $($_.intendedDecision)`n- Contradiction risk: $($_.contradictionRisk)`n- Filter context: $($_.filterContextHint)`n"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine;if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8};$content
