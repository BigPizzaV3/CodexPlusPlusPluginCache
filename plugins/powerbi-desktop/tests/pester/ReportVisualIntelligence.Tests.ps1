$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')
$scriptsPath = Join-Path $pluginRoot 'scripts'

Describe 'Power BI report and visual intelligence' {
    BeforeAll {
        $caseRoot = Join-Path $TestDrive 'visual-intelligence-case'
        New-Item -ItemType Directory -Path $caseRoot -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $caseRoot 'Report/pages/Page1/visuals/Visual1') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $caseRoot 'Report/pages/Page1/visuals/Visual2') -Force | Out-Null

        @'
[Total Sales] =
SUM ( Sales[Amount] )

[Margin %] =
DIVIDE ( [Total Sales], SUM ( Sales[Cost] ) )

[Unused KPI] =
CALCULATE ( [Total Sales], FILTER ( ALL ( Sales ), Sales[Amount] > 0 ) )
'@ | Set-Content -LiteralPath (Join-Path $caseRoot 'Sales.Measures.dax') -Encoding UTF8

        @{
            name = 'SalesCard'
            singleVisual = @{
                visualType = 'card'
                projections = @{
                    Values = @(@{ queryRef = 'Total Sales' })
                }
            }
            filters = @(@{ field = 'Sales[Region]' })
        } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $caseRoot 'Report/pages/Page1/visuals/Visual1/visual.json') -Encoding UTF8

        @{
            name = 'MarginTrend'
            singleVisual = @{
                visualType = 'lineChart'
                projections = @{
                    Values = @(@{ queryRef = 'Margin %' })
                }
            }
        } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $caseRoot 'Report/pages/Page1/visuals/Visual2/visual.json') -Encoding UTF8

        $script:caseRoot = $caseRoot
    }

    It 'maps report JSON visuals to semantic measures' {
        $impact = & (Join-Path $scriptsPath 'New-PowerBIVisualMeasureImpactMap.ps1') -Path $script:caseRoot -Json | ConvertFrom-Json
        $impact.reportMetadataStatus | Should Be 'Available'
        $impact.visualCount | Should Be 2
        ($impact.impacts | Where-Object { $_.measure -eq 'Total Sales' }).detectedVisualReferences | Should BeGreaterThan 0
        ($impact.impacts | Where-Object { $_.measure -eq 'Margin %' }).affectedVisuals[0].visualType | Should Be 'lineChart'
    }

    It 'creates concrete visual findings from metadata' {
        $intent = & (Join-Path $scriptsPath 'New-PowerBIVisualIntentAnalyzer.ps1') -Path $script:caseRoot -Json | ConvertFrom-Json
        $intent.reportMetadataStatus | Should Be 'Available'
        $intent.findingCount | Should BeGreaterThan 0
        @($intent.findings | Where-Object { $_.category -eq 'Risky Visual' }).Count | Should BeGreaterThan 0
        @($intent.findings | Where-Object { $_.category -eq 'Missing Measure' -and $_.title -match 'Unused KPI' }).Count | Should Be 1
        @($intent.visualMeasureLineage | Where-Object { $_.measure -eq 'Total Sales' }).Count | Should BeGreaterThan 0
    }

    It 'returns a structured screenshot review envelope without requiring Power BI Desktop' {
        $missing = & (Join-Path $scriptsPath 'New-PowerBIReportScreenshotUXReview.ps1') -ImagePath (Join-Path $TestDrive 'missing.png') -Json | ConvertFrom-Json
        $missing.status | Should Be 'NotAvailable'
        $missing.needsInput | Should Be $true

        $imagePath = Join-Path $TestDrive 'page.png'
        [System.IO.File]::WriteAllBytes($imagePath, [byte[]](137,80,78,71,13,10,26,10))
        $review = & (Join-Path $scriptsPath 'New-PowerBIReportScreenshotUXReview.ps1') -ImagePath $imagePath -Json | ConvertFrom-Json
        $review.status | Should Be 'NeedsVisionReview'
        $review.reviewMode | Should Be 'ScreenshotEnvelope'
        $review.findingCount | Should Be 1
    }

    It 'flags executive narrative quality risks from report metadata' {
        $quality = & (Join-Path $scriptsPath 'New-PowerBIExecutiveNarrativeQualityAgent.ps1') -Path $script:caseRoot -Json | ConvertFrom-Json

        $quality.schema | Should Be 'codex.powerbi.executiveNarrativeQuality.v1'
        $quality.qualityScore | Should BeGreaterThan -1
        $quality.findings.Count | Should BeGreaterThan 0
        @($quality.findings | Where-Object { $_.category -in @('visual_narrative_mismatch','release_gate_conflict','missing_variance_context') }).Count | Should BeGreaterThan 0
    }
}
