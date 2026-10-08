param(
    [Parameter(Mandatory=$true)][string]$PbipPath,
    [Parameter(Mandatory=$true)][string]$OutputPbix,
    [string]$OutputPath,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = & (Join-Path $scriptRoot 'Get-PowerBIExternalToolInventory.ps1') -Json | ConvertFrom-Json
$pbiTools = @($tools.tools | Where-Object name -eq 'pbi-tools' | Select-Object -First 1)
$desktop = @($tools.tools | Where-Object name -eq 'Power BI Desktop' | Select-Object -First 1)
$resolvedPbip = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PbipPath)
$structurePath = if (Test-Path -LiteralPath $resolvedPbip -PathType Leaf) { Split-Path -Parent $resolvedPbip } else { $resolvedPbip }
$structure = & (Join-Path $scriptRoot 'Get-PowerBIPBIPStructure.ps1') -Path $structurePath -Json | ConvertFrom-Json
$recommended = if ($pbiTools.installed -and $structure.roundtripStatus -ne 'Incomplete') { 'pbi-tools compile' } else { 'Power BI Desktop Save As PBIX' }
$status = if ($pbiTools.installed -and $structure.roundtripStatus -eq 'Ready') { 'Ready' } elseif ($pbiTools.installed) { 'Warning' } else { 'Warning' }
$warnings = New-Object System.Collections.Generic.List[string]
if (-not $pbiTools.installed) { $warnings.Add('pbi-tools was not detected. Automated PBIX compile cannot be executed by this workflow.') }
if ($structure.roundtripStatus -ne 'Ready') { $warnings.Add(('PBIP structure roundtrip status is {0}; review structure checks before compiling.' -f $structure.roundtripStatus)) }
if (-not $desktop.installed) { $warnings.Add('Power BI Desktop was not detected. Manual PBIP open/save validation may not be available on this machine.') }
$commands = @()
if ($pbiTools.installed -and $structure.roundtripStatus -ne 'Incomplete') {
    $commands += ('"{0}" compile "{1}" -format PBIX -out "{2}"' -f $pbiTools.path, $resolvedPbip, $OutputPbix)
}
if ($desktop.installed) {
    $commands += ('Open PBIP in Power BI Desktop: "{0}"' -f $desktop.path)
    $commands += ('Use File > Save As and choose PBIX output: "{0}"' -f $OutputPbix)
}
$steps = @(
    'Review PBIP structure checks and confirm the roundtrip status is not Incomplete.',
    'Run Trust Release Gate and resolve No-Go findings.',
    'Open the PBIP project and validate pages/visuals in Power BI Desktop.',
    'Compile with pbi-tools if installed, otherwise Save As PBIX in Power BI Desktop.',
    'Open the produced PBIX and rerun live validation before publishing.'
)
$validationPlan = @(
    'Do not modify the source PBIX in this workflow.',
    'Use pbi-tools only when installed and PBIP structure checks are complete enough for round-tripping.',
    'When pbi-tools is unavailable, treat this as a validation plan: Desktop must open the PBIP and save a PBIX candidate manually.',
    'Record the produced PBIX path, semantic test result, live availability, and release gate decision before release.'
)
$result = [pscustomobject]@{
    schema = 'codex.powerbi.pbixCompileWorkflow.v1'
    workflow = 'PBIP to PBIX'
    status = $status
    pbipPath = $resolvedPbip
    outputPbix = $OutputPbix
    recommendedPath = $recommended
    pbiToolsInstalled = [bool]$pbiTools.installed
    pbiToolsPath = $pbiTools.path
    powerBIDesktopInstalled = [bool]$desktop.installed
    pbipStructure = [pscustomobject]@{
        readiness = $structure.readiness
        roundtripStatus = $structure.roundtripStatus
        score = $structure.score
        checks = $structure.checks
    }
    warnings = @($warnings)
    validationPlan = $validationPlan
    commands = $commands
    steps = $steps
}
if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$md = @('# Power BI PBIP to PBIX Compile Workflow', '', "Status: **$status**", "Recommended path: $recommended", '', '## Warnings') + @($warnings | ForEach-Object { "- $_" }) + @('', '## Validation plan') + @($validationPlan | ForEach-Object { "- $_" }) + @('', '## Steps') + @($steps | ForEach-Object { "- $_" }) + @('', '## Commands') + @($commands | ForEach-Object { '```powershell' + [Environment]::NewLine + $_ + [Environment]::NewLine + '```' })
$content = ($md -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
