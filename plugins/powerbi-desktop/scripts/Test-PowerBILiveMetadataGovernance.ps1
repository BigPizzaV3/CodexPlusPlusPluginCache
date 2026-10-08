param(
    [string]$Server,
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$catalog = & (Join-Path $PSScriptRoot 'New-PowerBILiveMetricCatalog.ps1') -Server $Server -Json | ConvertFrom-Json
$summary = & (Join-Path $PSScriptRoot 'Get-PowerBILiveModelSummary.ps1') -Server $Server -Json | ConvertFrom-Json

$findings = New-Object System.Collections.Generic.List[object]
function Add-Finding {
    param([string]$Severity, [string]$Category, [string]$Title, [string]$Source, [string]$Detail)
    $findings.Add([pscustomobject]@{ severity = $Severity; category = $Category; title = $Title; source = $Source; detail = $Detail })
}

foreach ($metric in @($catalog.metrics)) {
    if (-not $metric.description) {
        Add-Finding -Severity 'Low' -Category 'Measure Metadata' -Title 'Missing measure description' -Source $metric.name -Detail 'Add a business definition to the measure description.'
    }
    if (-not $metric.formatString -and $metric.expression -match '(?i)\bDIVIDE\s*\(|\bsum\s*\(|\bcount') {
        Add-Finding -Severity 'Low' -Category 'Measure Metadata' -Title 'Missing format string' -Source $metric.name -Detail 'Add an explicit format string for consistent report presentation.'
    }
    if ($metric.name -match '^\s*_' -and -not $metric.isHidden) {
        Add-Finding -Severity 'Low' -Category 'Naming' -Title 'Technical-looking visible measure' -Source $metric.name -Detail 'Visible measures with leading underscores may be confusing for report consumers.'
    }
}

$hiddenLocalDateTables = @($summary.tables | Where-Object { $_.Name -like 'LocalDateTable_*' })
if ($hiddenLocalDateTables.Count -gt 5) {
    Add-Finding -Severity 'Medium' -Category 'Model Metadata' -Title 'Many local date tables' -Source 'model' -Detail ("Detected {0} hidden local date tables. Prefer a governed date table." -f $hiddenLocalDateTables.Count)
}

$result = [pscustomobject]@{
    schema = 'codex.powerbi.liveMetadataGovernance.v1'
    generated = (Get-Date).ToString('s')
    findingCount = $findings.Count
    findings = @($findings.ToArray())
}

if ($Json) {
    $jsonText = $result | ConvertTo-Json -Depth 8
    if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $jsonText -Encoding UTF8 }
    $jsonText
    return
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Power BI Live Metadata Governance')
$lines.Add('')
$lines.Add(('Findings: {0}' -f $result.findingCount))
$lines.Add('')
foreach ($finding in $result.findings) {
    $lines.Add(('## [{0}] {1}' -f $finding.severity, $finding.title))
    $lines.Add(('- Category: {0}' -f $finding.category))
    $lines.Add(('- Source: `{0}`' -f $finding.source))
    $lines.Add(('- Detail: {0}' -f $finding.detail))
    $lines.Add('')
}
$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8 }
$content
