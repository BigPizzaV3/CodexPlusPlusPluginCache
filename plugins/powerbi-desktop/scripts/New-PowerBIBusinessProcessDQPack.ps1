param(
    [string]$Path = ".",
    [ValidateSet('All','OrderToCash','ProcureToPay','RecordToReport','HireToRetire','PlanToProduce','ForecastToDeliver','ServiceToCash','IssueToResolution','LeadToOpportunity','QuoteToOrder')]
    [string]$ProcessPack = 'All',
    [string]$DataPath,
    [string]$MappingPath,
    [string]$OutputDirectory = "powerbi-business-process-dq",
    [switch]$Json,
    [switch]$FailOnHigh
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$result = & (Join-Path $scriptRoot 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $Path -ProcessPack $ProcessPack -DataPath $DataPath -MappingPath $MappingPath -OutputDirectory $OutputDirectory -Json:$Json -FailOnHigh:$FailOnHigh
$result
