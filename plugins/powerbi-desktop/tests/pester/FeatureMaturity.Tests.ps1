$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'
$samplePath = Join-Path $pluginRoot 'examples/sample-model'

Describe 'Power BI feature maturity' {
    It 'classifies live, snapshot, draft, metadata, synthetic, and simulation capabilities' {
        $maturity = & (Join-Path $scriptsPath 'New-PowerBIFeatureMaturityMap.ps1') -Json | ConvertFrom-Json

        $maturity.schema | Should Be 'codex.powerbi.featureMaturityMap.v1'
        $maturity.featureCount | Should BeGreaterThan 5
        @($maturity.features | Where-Object maturity -eq 'LiveReadOrSnapshot').Count | Should BeGreaterThan 0
        @($maturity.features | Where-Object maturity -eq 'DraftAndApply').Count | Should BeGreaterThan 0
        @($maturity.features | Where-Object maturity -eq 'HeuristicSimulation').Count | Should BeGreaterThan 0
    }

    It 'reports report render evidence maturity explicitly' {
        $render = & (Join-Path $scriptsPath 'Test-PowerBIReportRenderReadiness.ps1') -Path $samplePath -Json | ConvertFrom-Json

        $render.schema | Should Be 'codex.powerbi.reportRenderReadiness.v1'
        (@('EvidenceBacked','MetadataOnly','Blocked') -contains $render.evidenceMaturity) | Should Be $true
        $render.readyForAutomatedPublish | Should Be $false
    }
}
