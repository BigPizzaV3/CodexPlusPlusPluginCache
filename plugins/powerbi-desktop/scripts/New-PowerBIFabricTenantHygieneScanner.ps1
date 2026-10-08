param([string]$SnapshotDirectory, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PowerBIFabricSnapshot.Shared.ps1')
$s = Get-FabricSnapshot -SnapshotDirectory $SnapshotDirectory -DefaultName 'portfolio-risk'
$findings = @()
$missingOwners = @($s.items | Where-Object { -not $_.owner })
$missingLabels = @($s.items | Where-Object { -not $_.sensitivityLabel })
$unused = @($s.items | Where-Object { $_.usageScore -eq $null -or $_.usageScore -lt 10 })
if ($missingOwners.Count) { $findings += New-FabricFinding High Ownership "$($missingOwners.Count) items miss owners." }
if ($missingLabels.Count) { $findings += New-FabricFinding Medium Sensitivity "$($missingLabels.Count) items miss sensitivity labels." }
if ($unused.Count) { $findings += New-FabricFinding Medium Usage "$($unused.Count) items have low or missing usage." }
$result = [pscustomobject]@{ schema='codex.powerbi.fabricTenantHygieneScanner.v1'; title='Power BI Fabric Tenant Hygiene Scanner'; generated=(Get-Date).ToString('s'); snapshotDirectory=$s.root; status=if(@($findings|Where-Object severity -eq 'High').Count){'NeedsCleanup'}elseif($findings.Count){'ReviewReady'}else{'Clean'}; findingCount=$findings.Count; findings=$findings }
Write-FabricResult -Result $result -OutputPath $OutputPath -Json:$Json
