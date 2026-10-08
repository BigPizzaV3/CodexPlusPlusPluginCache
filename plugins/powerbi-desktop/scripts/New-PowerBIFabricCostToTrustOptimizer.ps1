param([string]$SnapshotDirectory, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s = Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'portfolio-risk'
$capacityRisk = @($s.capacities | Where-Object { $_.utilizationPct -ge 85 -or $_.throttlingEvents -gt 0 }).Count
$items = foreach($item in $s.items){
    $trustScore = if ($null -ne $item.trustScore) { [int]$item.trustScore } else { 50 }
    $usageScore = if ($null -ne $item.usageScore) { [int]$item.usageScore } else { 0 }
    $score = (100 - $trustScore) + ($usageScore / 2) + (20 * $capacityRisk)
    [pscustomobject]@{ itemId=$item.id; name=$item.name; type=$item.type; trustScore=$item.trustScore; usageScore=$item.usageScore; optimizationPriority=if($score -ge 90){'High'}elseif($score -ge 55){'Medium'}else{'Low'}; recommendation='Improve trust, reduce refresh/capacity cost, consolidate, or retire.' }
}
$high=@($items|Where-Object optimizationPriority -eq 'High').Count
$result=[pscustomobject]@{schema='codex.powerbi.fabricCostToTrustOptimizer.v1';title='Power BI Fabric Cost-To-Trust Optimizer';generated=(Get-Date).ToString('s');snapshotDirectory=$s.root;status=if($high){'HighOptimizationPotential'}else{'OptimizationBacklogReady'};highPriorityCount=$high;itemCount=@($items).Count;items=@($items);findings=@()}
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
