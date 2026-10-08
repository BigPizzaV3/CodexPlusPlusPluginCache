param([string]$Path = ".", [string]$TenantExportPath, [string]$OutputPath, [switch]$Json)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$service = & (Join-Path $scriptRoot 'New-PowerBIServiceScanner.ps1') -Path $Path -Json | ConvertFrom-Json
$inventory = & (Join-Path $scriptRoot 'Get-PowerBIInventory.ps1') -Path $Path -Json | ConvertFrom-Json
$exportStatus = if ($TenantExportPath -and (Test-Path -LiteralPath $TenantExportPath)) { 'Available' } else { 'NeedsExport' }
$findings = @($service.findings) + @([pscustomobject]@{ severity = 'Medium'; area = 'TenantExport'; message = if ($exportStatus -eq 'NeedsExport') { 'Tenant/workspace export not supplied; orphaned workspace and share checks are limited.' } else { 'Tenant export supplied for offline hygiene review.' } })
$result = [pscustomobject]@{ schema = 'codex.powerbi.tenantHygieneScanner.v1'; root = (Resolve-Path -LiteralPath $Path).Path; generated = (Get-Date).ToString('s'); tenantExportStatus = $exportStatus; reportFileCount = @($inventory.files).Count; findingCount = @($findings).Count; status = if ($exportStatus -eq 'NeedsExport') { 'NeedsTenantExport' } elseif (@($findings | Where-Object severity -eq 'High').Count -gt 0) { 'NeedsCleanup' } else { 'ReviewReady' }; findings = @($findings) }
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$content = "# Power BI Tenant Hygiene Scanner`n`nStatus: **$($result.status)**`n"
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
