param([string]$SnapshotDirectory, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s = Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'portfolio-risk'
$lowTrust = @($s.items | Where-Object { $_.trustScore -lt 70 })
$orphaned = @($s.items | Where-Object { -not $_.owner })
$failedRefresh = @($s.refreshHistory | Where-Object { $_.status -eq 'Failed' })
$findings = @()
if ($orphaned.Count -gt 0) { $findings += New-FabricFinding High Ownership "$($orphaned.Count) Fabric items have no owner." }
if ($lowTrust.Count -gt 0) { $findings += New-FabricFinding Medium Trust "$($lowTrust.Count) Fabric items are below trust threshold." }
if ($failedRefresh.Count -gt 0) { $findings += New-FabricFinding High Refresh "$($failedRefresh.Count) refresh failures detected." }
$result = [pscustomobject]@{ schema='codex.powerbi.fabricPortfolioCommandCenter.v1'; title='Power BI Fabric Portfolio Command Center'; generated=(Get-Date).ToString('s'); snapshotDirectory=$s.root; workspaceName=$s.workspace.name; status=if(@($findings|Where-Object severity -eq 'High').Count){'PortfolioAtRisk'}elseif($findings.Count){'NeedsGovernanceReview'}else{'PortfolioStable'}; itemCount=$s.items.Count; findingCount=$findings.Count; findings=$findings }
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
