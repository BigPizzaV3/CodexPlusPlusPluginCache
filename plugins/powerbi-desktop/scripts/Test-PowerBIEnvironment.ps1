param(
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

function Find-CommandPath {
    param([string[]]$Names, [string[]]$Paths = @())

    foreach ($name in $Names) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            return $cmd.Source
        }
    }

    foreach ($path in $Paths) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            return $path
        }
    }

    return $null
}

function Find-AdomdClientPath {
    $candidates = @(
        'C:\Program Files\Microsoft.NET\ADOMD.NET\170\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files\DAX Studio\bin\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files\Microsoft SQL Server Management Studio 22\Release\Common7\IDE\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files\Microsoft SQL Server Management Studio 21\Release\Common7\IDE\Microsoft.AnalysisServices.AdomdClient.dll',
        'C:\Program Files (x86)\Microsoft.NET\ADOMD.NET\170\Microsoft.AnalysisServices.AdomdClient.dll'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

$desktopCandidates = @(@(
    "$env:ProgramFiles\Microsoft Power BI Desktop\bin\PBIDesktop.exe",
    "${env:ProgramFiles(x86)}\Microsoft Power BI Desktop\bin\PBIDesktop.exe",
    "$env:LOCALAPPDATA\Microsoft\WindowsApps\PBIDesktop.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

$result = [ordered]@{
    PowerBIDesktop = if ($desktopCandidates.Count -gt 0) { $desktopCandidates[0] } else { $null }
    TabularEditor = Find-CommandPath @('TabularEditor.exe', 'te.exe') @(
        "$env:ProgramFiles\Tabular Editor 2\TabularEditor.exe",
        "${env:ProgramFiles(x86)}\Tabular Editor\TabularEditor.exe"
    )
    DaxStudio = Find-CommandPath @('DaxStudio.exe') @(
        "$env:ProgramFiles\DAX Studio\DaxStudio.exe",
        "${env:ProgramFiles(x86)}\DAX Studio\DaxStudio.exe"
    )
    PbiTools = Find-CommandPath @('pbi-tools.exe', 'pbi-tools') @(
        "$env:LOCALAPPDATA\Programs\pbi-tools\pbi-tools.exe"
    )
    ALMToolkit = Find-CommandPath @('ALMToolkit.exe', 'BismNormalizer.exe') @(
        "$env:ProgramFiles\ALM Toolkit\ALMToolkit.exe",
        "$env:ProgramFiles\BISM Normalizer\BismNormalizer.exe",
        "${env:ProgramFiles(x86)}\ALM Toolkit\ALMToolkit.exe"
    )
    PowerBIHelper = Find-CommandPath @('PowerBIHelper.exe') @(
        "$env:ProgramFiles\Power BI Helper\PowerBIHelper.exe",
        "${env:ProgramFiles(x86)}\Power BI Helper\PowerBIHelper.exe"
    )
    ModelDocumenter = Find-CommandPath @('ModelDocumenter.exe') @(
        "$env:ProgramFiles\Model Documenter\ModelDocumenter.exe",
        "${env:ProgramFiles(x86)}\Model Documenter\ModelDocumenter.exe"
    )
    PBITips = Find-CommandPath @('ThemesGenerator.exe', 'LayoutTool.exe') @(
        "$env:ProgramFiles\PBI.tips\ThemesGenerator.exe",
        "$env:ProgramFiles\PBI.tips\LayoutTool.exe"
    )
    DotNet = Find-CommandPath @('dotnet.exe', 'dotnet')
    AdomdClient = Find-AdomdClientPath
}

if ($Json) {
    $result | ConvertTo-Json -Depth 3
    return
}

$result.GetEnumerator() | ForEach-Object {
    $status = if ($_.Value) { $_.Value } else { 'not found' }
    "{0}: {1}" -f $_.Key, $status
}
