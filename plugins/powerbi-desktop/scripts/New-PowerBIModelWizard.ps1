param(
    [Parameter(Mandatory)][string]$ProjectName,
    [string]$OutputDirectory = '.',
    [string]$BusinessPurpose = 'Describe the decision this model should support.',
    [string[]]$DataSourcePaths = @(),
    [string]$DataSourceConfigPath,
    [string[]]$SourceNames = @(),
    [string[]]$FactTables = @(),
    [string[]]$DimensionTables = @(),
    [string[]]$Kpis = @(),
    [switch]$Initialize,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
if ($ProjectName -notmatch '^[A-Za-z0-9][A-Za-z0-9 _-]*$') { throw 'ProjectName must contain only letters, numbers, spaces, underscores, or hyphens.' }
$projectRoot = Join-Path ($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)) $ProjectName
function Get-SourceProfile {
    param([string]$SourcePath)
    if (-not (Test-Path -LiteralPath $SourcePath)) { throw "Data source not found: $SourcePath" }
    $item = Get-Item -LiteralPath $SourcePath
    if ($item.PSIsContainer) { throw "Data source must be a file, not a directory: $SourcePath" }
    $columns = @()
    switch ($item.Extension.ToLowerInvariant()) {
        '.csv' { $first = @(Import-Csv -LiteralPath $item.FullName | Select-Object -First 1); if ($first) { $columns = @($first[0].PSObject.Properties.Name) } }
        '.json' { $raw = Get-Content -Raw -LiteralPath $item.FullName | ConvertFrom-Json; $row = if ($raw.PSObject.Properties.Name -contains 'value') { @($raw.value | Select-Object -First 1) } elseif ($raw -is [array]) { @($raw | Select-Object -First 1) } else { @($raw) }; if ($row) { $columns = @($row[0].PSObject.Properties.Name) } }
        default { $columns = @('Schema inspection requires CSV or JSON; define fields in the generated data contract.') }
    }
    [pscustomobject]@{ name=([IO.Path]::GetFileNameWithoutExtension($item.Name) -replace '[^A-Za-z0-9_]','_'); path=$item.FullName; extension=$item.Extension; columns=$columns }
}
$localProfiles = @($DataSourcePaths | ForEach-Object { Get-SourceProfile $_ })
$declaredProfiles = @()
if ($DataSourceConfigPath) {
    if (-not (Test-Path -LiteralPath $DataSourceConfigPath)) { throw "DataSourceConfigPath not found: $DataSourceConfigPath" }
    $sourceConfig = Get-Content -Raw -LiteralPath $DataSourceConfigPath | ConvertFrom-Json
    if ($sourceConfig.schema -ne 'codex.powerbi.dataSourceConfig.v1') { throw 'Unsupported data source configuration schema.' }
    $declaredProfiles = @($sourceConfig.sources | ForEach-Object {
        if (-not $_.name -or -not $_.connectorKind) { throw 'Every declared source requires name and connectorKind.' }
        $safeConnection = [string]$_.connection
        $safeConnection = $safeConnection -replace '(?i)(password|pwd|access[_ -]?token|client[_ -]?secret)\s*=\s*[^;\s]+','$1=[REDACTED]'
        [pscustomobject]@{ name=($_.name -replace '[^A-Za-z0-9_]','_'); path=$safeConnection; extension='DeclaredConnector'; connectorKind=$_.connectorKind; columns=@($_.columns); mode=if($_.mode){$_.mode}else{'Import'}; schemaStatus=if(@($_.columns).Count){'DeclaredSchema'}else{'SchemaRequiredInDesktop'} }
    })
}
$profiles = @($localProfiles + $declaredProfiles)
$sources = if ($profiles.Count) { @($profiles.name) } elseif ($SourceNames.Count) { $SourceNames } else { @('Define primary source') }
$inferredFacts = @($profiles | Where-Object { $_.name -match '(?i)sales|order|transaction|fact|invoice|event|activity' } | ForEach-Object { 'Fact' + $_.name })
$facts = if ($FactTables.Count) { $FactTables } elseif ($inferredFacts.Count) { $inferredFacts } elseif ($profiles.Count) { @('Fact' + $profiles[0].name) } else { @('FactSales') }
$dateColumns = @($profiles | ForEach-Object { $_.columns | Where-Object { $_ -match '(?i)date|month|year|time' } } | Select-Object -Unique)
$dimensions = if ($DimensionTables.Count) { $DimensionTables } elseif ($dateColumns.Count) { @('DimDate') } else { @('DimDate','DimEntity') }
$numericHint = @($profiles | ForEach-Object { $_.columns | Where-Object { $_ -match '(?i)amount|revenue|sales|value|cost|quantity|qty' } } | Select-Object -First 1)
$measures = if ($Kpis.Count) { $Kpis } elseif ($numericHint.Count) { @('Total ' + $numericHint[0], 'Record Count', 'Trend %') } else { @('Record Count','Trend %','Data Freshness') }

$design = [pscustomobject]@{
    schema = 'codex.powerbi.modelWizard.v1'
    projectName = $ProjectName
    businessPurpose = $BusinessPurpose
    evidenceMaturity = 'Draft'
    architecture = [pscustomobject]@{ pattern='StarSchema'; factTables=$facts; dimensionTables=$dimensions; sourceNames=$sources; sourceProfiles=$profiles; connectorSupport='Any connector available in the user''s installed Power BI Desktop Get Data experience can be declared by connectorKind.' }
    semanticPlan = [pscustomobject]@{ measures=$measures; requiredPolicies=@('Assign KPI owner','Add measure descriptions','Define RLS roles','Define freshness SLO','Add semantic tests') }
    reportPlan = [pscustomobject]@{ pages=@('Executive Overview','Trend and Drivers','Detail Explorer','Data Quality'); firstPageKpis=$measures }
    safeNextSteps = @('Create a new PBIP project in Power BI Desktop.', 'Copy reviewed model and report drafts into the PBIP project.', 'Configure credentials only in Power BI Desktop or an approved gateway.', 'Run semantic tests and open the project in Power BI Desktop before publishing.')
    binaryBoundary = 'The wizard does not create or modify PBIX/PBIT binaries and does not publish to Power BI or Fabric.'
}

if ($Initialize) {
    if (Test-Path -LiteralPath $projectRoot) { throw "Project directory already exists: $projectRoot" }
    New-Item -ItemType Directory -Path $projectRoot | Out-Null
    $draftRoot = Join-Path $projectRoot 'codex-model-drafts'
    New-Item -ItemType Directory -Path $draftRoot | Out-Null
    $designPath = Join-Path $draftRoot 'model-design.json'
    $design | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $designPath -Encoding UTF8
    $contract = [pscustomobject]@{ schema='codex.powerbi.dataContractDraft.v1'; sources=$sources; facts=$facts; dimensions=$dimensions; rules=@('Keys must be non-null and unique in dimensions.','Fact tables must reference dimensions through defined keys.','Every KPI must declare owner, grain, format, and refresh expectation.') }
    $contract | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $draftRoot 'data-contract-draft.json') -Encoding UTF8
    $connections = @($profiles | ForEach-Object { [pscustomobject]@{ name=$_.name; connectorKind=if($_.connectorKind){$_.connectorKind}else{'File'}; connection=$_.path; mode=if($_.mode){$_.mode}else{'Import'}; columns=$_.columns; status=if($_.extension -eq 'DeclaredConnector'){'ConfigureInPowerBIDesktop'}else{'LocallyProfiled'}; credentialPolicy='Configure credentials only in Power BI Desktop or an approved gateway; never store secrets in this draft.' } })
    $connections | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $draftRoot 'connection-drafts.json') -Encoding UTF8
    $measureDrafts = @($measures | ForEach-Object { [pscustomobject]@{ measureName=$_; tableName=$facts[0]; expression='TODO: define approved DAX expression'; owner='TODO: assign owner'; description='TODO: define business meaning' } })
    $measureDrafts | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $draftRoot 'measure-drafts.json') -Encoding UTF8
    $queryLines = @('# Power Query Source Drafts','') + @($profiles | ForEach-Object { ('## {0}`n`n```powerquery`nlet`n    Source = Csv.Document(File.Contents("{1}"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv])`nin`n    Source`n```' -f $_.name, $_.path) })
    if (-not $profiles.Count) { $queryLines += 'Add local CSV/JSON source paths to generate inspectable source drafts.' }
    Set-Content -LiteralPath (Join-Path $draftRoot 'power-query-source-drafts.md') -Value (($queryLines -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8
    $readme = @('# Power BI Model Wizard Drafts','',"Business purpose: $BusinessPurpose",'', '## Generated from data sources','', ($profiles | ForEach-Object { "- $($_.name): $($_.path)" }), '', '## Next steps','', '1. In Power BI Desktop, create a new project and save it as PBIP.', '2. Copy the reviewed Power Query source drafts and build the generated star schema.', '3. Turn each reviewed measure draft into TMDL with `New-PowerBIMeasureDraft.ps1`.', '4. Create report pages from the report plan, then run `Invoke-PowerBIUnifiedReview.ps1`.', '', 'These drafts are not a PBIP project and must be reviewed before being applied.') -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $projectRoot 'README.md') -Value ($readme + [Environment]::NewLine) -Encoding UTF8
    $design | Add-Member -NotePropertyName initializedDraftDirectory -NotePropertyValue $draftRoot
}

if ($Json) { $design | ConvertTo-Json -Depth 12 } else { $design }
