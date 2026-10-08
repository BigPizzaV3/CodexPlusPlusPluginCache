$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'
$samplePath = Join-Path $pluginRoot 'examples/sample-model'
$dataPath = Join-Path $pluginRoot 'examples/business-process-data'

Describe 'Power BI business process data quality' {
    It 'parses all process rule packs' {
        $packs = @(Get-ChildItem -LiteralPath (Join-Path $pluginRoot 'rules/process-packs') -File -Filter '*.json' | ForEach-Object {
            Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json
        })
        $packs.Count | Should BeGreaterThan 9
        @($packs | Where-Object { $_.schema -ne 'codex.powerbi.processRulePack.v1' }).Count | Should Be 0
    }

    It 'creates a mapping proposal from PBIP metadata and ERP exports' {
        $mapping = & (Join-Path $scriptsPath 'New-PowerBIProcessDataMapping.ps1') -Path $samplePath -DataPath $dataPath -Json | ConvertFrom-Json
        $mapping.schema | Should Be 'codex.powerbi.processDataMapping.v1'
        $mapping.mappedObjectCount | Should BeGreaterThan 0
        $mapping.status | Should Be 'NeedsMapping'
    }

    It 'detects Order-to-Cash export data issues' {
        $dq = & (Join-Path $scriptsPath 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $samplePath -DataPath $dataPath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-o2c-dq') -ProcessPack OrderToCash -Json | ConvertFrom-Json
        $dq.schema | Should Be 'codex.powerbi.businessProcessDataQuality.v1'
        $dq.highCount | Should BeGreaterThan 0
        $findings = Get-Content -Raw -LiteralPath (Join-Path $pluginRoot 'tmp/pester-o2c-dq/process-findings.json') | ConvertFrom-Json
        (($findings.findings | Select-Object -ExpandProperty ruleId) -contains 'o2c.invoice.order.orphan') | Should Be $true
    }

    It 'detects Procure-to-Pay and Record-to-Report export issues' {
        $p2p = & (Join-Path $scriptsPath 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $samplePath -DataPath $dataPath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-p2p-dq') -ProcessPack ProcureToPay -Json | ConvertFrom-Json
        $r2r = & (Join-Path $scriptsPath 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $samplePath -DataPath $dataPath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-r2r-dq') -ProcessPack RecordToReport -Json | ConvertFrom-Json
        $p2p.highCount | Should BeGreaterThan 0
        $r2r.highCount | Should BeGreaterThan 0
    }

    It 'supports Power-BI-only execution without export data' {
        $dq = & (Join-Path $scriptsPath 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-powerbi-only-dq') -ProcessPack OrderToCash -Json | ConvertFrom-Json
        $dq.schema | Should Be 'codex.powerbi.businessProcessDataQuality.v1'
        $dq.status | Should Be 'NeedsMapping'
        $dq.mappingNeedsCount | Should BeGreaterThan 0
    }

    It 'supports export-only style execution with a non-model path' {
        $dq = & (Join-Path $scriptsPath 'Invoke-PowerBIBusinessProcessDataQuality.ps1') -Path $dataPath -DataPath $dataPath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-export-only-dq') -ProcessPack All -Json | ConvertFrom-Json
        $dq.schema | Should Be 'codex.powerbi.businessProcessDataQuality.v1'
        $dq.findingCount | Should BeGreaterThan 0
    }

    It 'adds optional business process DQ evidence to release candidate packs' {
        $candidate = & (Join-Path $scriptsPath 'New-PowerBIReleaseCandidatePack.ps1') -Path $samplePath -OutputDirectory (Join-Path $pluginRoot 'tmp/pester-release-process-dq') -IncludeBusinessProcessDQ -BusinessProcessDataPath $dataPath
        $summary = Get-Content -Raw -LiteralPath $candidate.Summary | ConvertFrom-Json
        $summary.enterpriseUsps.businessProcessDqStatus | Should Not Be 'NotRun'
        $summary.enterpriseUsps.businessProcessDqHighCount | Should BeGreaterThan 0
    }
}
