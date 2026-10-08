param(
    [string]$Name = "Codex Executive",
    [string]$OutputPath = "powerbi-theme.json",
    [string]$Primary = "#F2C811",
    [string]$Ink = "#171717",
    [string]$Accent = "#118DFF"
)

$ErrorActionPreference = 'Stop'

$theme = [ordered]@{
    name = $Name
    dataColors = @($Primary, $Accent, '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300')
    background = '#FFFFFF'
    foreground = $Ink
    tableAccent = $Primary
    visualStyles = [ordered]@{
        '*' = [ordered]@{
            '*' = [ordered]@{
                title = @([ordered]@{
                    show = $true
                    fontColor = @{ solid = @{ color = $Ink } }
                    fontSize = 11
                    fontFamily = 'Segoe UI'
                })
                visualHeader = @([ordered]@{
                    show = $true
                    foreground = @{ solid = @{ color = $Ink } }
                    background = @{ solid = @{ color = '#FFFFFF' } }
                    transparency = 0
                })
                background = @([ordered]@{
                    show = $true
                    color = @{ solid = @{ color = '#FFFFFF' } }
                    transparency = 0
                })
            }
        }
    }
}

$theme | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Get-Item -LiteralPath $OutputPath
