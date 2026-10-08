param([string]$Path = ".", [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalog = & (Join-Path $scriptRoot 'New-PowerBIMetricCatalog.ps1') -Path $Path -Json | ConvertFrom-Json
$readiness = & (Join-Path $scriptRoot 'Test-PowerBICopilotReadiness.ps1') -Path $Path -Json | ConvertFrom-Json
$questions = foreach ($metric in @($catalog.metrics)) {
    $ambiguous = ($metric.name -match 'Total|Count|Amount|Value' -and @($metric.tags).Count -le 1)
    [pscustomobject]@{ question=("What drives {0}?" -f $metric.name); targetMeasure=$metric.name; answerable=$true; ambiguityRisk=$ambiguous; recommendedSynonyms=@($metric.tags); requiredMetadata=@('description','businessDefinition','owner') }
}
$result=[pscustomobject]@{ schema='codex.powerbi.semanticModelCopilotEvaluator.v1'; generated=(Get-Date).ToString('s'); copilotScore=$readiness.score; questionCount=@($questions).Count; ambiguousQuestionCount=@($questions|Where-Object ambiguityRisk).Count; questions=@($questions) }
if($Json){$text=$result|ConvertTo-Json -Depth 8; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8}; $text; return}
$md=@('# Power BI Semantic Model Copilot Evaluator','',"Copilot score: $($result.copilotScore)","Questions: $($result.questionCount)","Ambiguous: $($result.ambiguousQuestionCount)",'')+@($result.questions|ForEach-Object{"- $($_.question) -> `$($_.targetMeasure)`; ambiguous=$($_.ambiguityRisk)"})
$content=($md -join [Environment]::NewLine)+[Environment]::NewLine; if($OutputPath){Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8}; $content
