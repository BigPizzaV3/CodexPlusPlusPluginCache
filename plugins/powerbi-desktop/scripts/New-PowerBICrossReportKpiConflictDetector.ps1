param(
    [string]$Path = ".",
    [string]$ComparisonPath,
    [string]$OutputPath,
    [switch]$Json,
    [double]$SimilarityThreshold = 0.72
)
$ErrorActionPreference = 'Stop'
if ($SimilarityThreshold -lt 0 -or $SimilarityThreshold -gt 1) { throw 'SimilarityThreshold must be between 0 and 1.' }
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$roots = New-Object System.Collections.Generic.List[string]
$roots.Add((Resolve-Path -LiteralPath $Path).Path)
if ($ComparisonPath) { $roots.Add((Resolve-Path -LiteralPath $ComparisonPath).Path) }
else {
    $children = @(Get-ChildItem -LiteralPath $roots[0] -Directory -ErrorAction SilentlyContinue | Where-Object { Get-ChildItem -LiteralPath $_.FullName -Recurse -Include *.dax,*.tmdl -File -ErrorAction SilentlyContinue | Select-Object -First 1 })
    foreach ($child in $children | Select-Object -First 8) { if ($child.FullName -ne $roots[0]) { $roots.Add($child.FullName) } }
}
function Normalize-KpiName([string]$Name) {
    if (-not $Name) { return '' }
    (($Name.ToLowerInvariant() -replace '[^a-z0-9]+',' ') -replace '\b(total|sum|amount|measure|metric|kpi|actual|budget|forecast)\b',' ' -replace '\s+',' ').Trim()
}
function Get-Tokens([string]$Expression) {
    if (-not $Expression) { return @() }
    @([regex]::Matches(($Expression.ToLowerInvariant() -replace '"[^"]*"',' '), '[a-z_][a-z0-9_]*') | ForEach-Object Value | Where-Object { $_ -notin @('var','return','calculate','filter','all','sum','divide','if') } | Sort-Object -Unique)
}
function Get-Jaccard($Left, $Right) {
    $l=@{}; foreach($x in @($Left)){if($x){$l[$x]=$true}}; $r=@{}; foreach($x in @($Right)){if($x){$r[$x]=$true}}
    $u=@{}; foreach($x in $l.Keys){$u[$x]=$true}; foreach($x in $r.Keys){$u[$x]=$true}
    if($u.Count -eq 0){return 0.0}; $i=0; foreach($x in $l.Keys){if($r.ContainsKey($x)){$i++}}; [math]::Round($i/[double]$u.Count,4)
}
$metrics = foreach ($root in @($roots | Select-Object -Unique)) {
    $catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $root -Json | ConvertFrom-Json
    foreach ($metric in @($catalog.metrics)) {
        [pscustomobject]@{ report = Split-Path -Leaf $root; root = $root; name = $metric.name; table = $metric.table; source = $metric.source; expression = $metric.expression; normalizedName = Normalize-KpiName $metric.name; tokens = @(Get-Tokens $metric.expression); risks = @($metric.risks) }
    }
}
$conflicts = New-Object System.Collections.Generic.List[object]
for ($i=0; $i -lt $metrics.Count; $i++) {
    for ($j=$i+1; $j -lt $metrics.Count; $j++) {
        $left=$metrics[$i]; $right=$metrics[$j]
        if ($left.root -eq $right.root) { continue }
        $nameScore = Get-Jaccard ($left.normalizedName -split ' ') ($right.normalizedName -split ' ')
        $exprScore = Get-Jaccard $left.tokens $right.tokens
        $score = [math]::Round(($nameScore * 0.45) + ($exprScore * 0.55), 4)
        $sameNameDifferentExpression = ($left.normalizedName -eq $right.normalizedName -and (($left.expression -replace '\s+',' ').Trim() -ne ($right.expression -replace '\s+',' ').Trim()))
        if ($score -ge $SimilarityThreshold -or $sameNameDifferentExpression) {
            $winner = @($left,$right | Sort-Object @{Expression={@($_.risks).Count}}, @{Expression={$_.expression.Length}} | Select-Object -First 1)
            $conflicts.Add([pscustomobject]@{ canonicalName = $winner.name; risk = if ($sameNameDifferentExpression) { 'High' } elseif ($score -ge .85) { 'Medium' } else { 'Low' }; reports = @($left.report,$right.report); definitionDifferences = @($left.expression,$right.expression); expressionSimilarity = $score; recommendedCanonicalMetric = ('{0} from {1}' -f $winner.name, $winner.report); requiredOwnerDecision = 'Confirm the canonical KPI definition and deprecate or rename conflicting metrics.' })
        }
    }
}
$result = [pscustomobject]@{ schema='codex.powerbi.crossReportKpiConflicts.v1'; generated=(Get-Date).ToString('s'); source=$roots[0]; comparisonRoots=@($roots); metricCount=@($metrics).Count; conflictCount=$conflicts.Count; conflicts=@($conflicts.ToArray()) }
if ($Json) { $text=$result|ConvertTo-Json -Depth 10; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8}; $text; return }
$md=@('# Power BI Cross-Report KPI Conflict Detector','',"Conflicts: $($result.conflictCount)",'')+@($result.conflicts|ForEach-Object{"## $($_.canonicalName)`n- Risk: $($_.risk)`n- Reports: $($_.reports -join ', ')`n- Similarity: $($_.expressionSimilarity)`n- Decision: $($_.requiredOwnerDecision)`n"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine
if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8}
$content
