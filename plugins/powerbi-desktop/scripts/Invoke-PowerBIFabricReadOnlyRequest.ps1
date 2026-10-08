param(
    [string]$AccessTokenPath,
    [string]$Uri,
    [ValidateSet('GET','POST','PUT','PATCH','DELETE')]
    [string]$Method = 'GET',
    [string]$OutputPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

function Redact-TokenText {
    param([string]$Text, [string]$Token)
    if (-not $Text) { return $Text }
    if ($Token) { return $Text.Replace($Token, '[REDACTED_TOKEN]') }
    return $Text
}

$token = $null
if ($AccessTokenPath -and (Test-Path -LiteralPath $AccessTokenPath)) {
    $token = (Get-Content -Raw -LiteralPath $AccessTokenPath).Trim()
}

if ($Method -ne 'GET') {
    $result = [pscustomobject]@{
        schema = 'codex.powerbi.fabricReadOnlyRequest.v1'
        generated = (Get-Date).ToString('s')
        uri = $Uri
        method = $Method
        status = 'BlockedUnsafeMethod'
        httpStatus = $null
        error = 'Fabric live v1 allows GET only. Mutating methods are blocked.'
        data = $null
    }
    if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
    $result
    return
}

if (-not $token) {
    $result = [pscustomobject]@{
        schema = 'codex.powerbi.fabricReadOnlyRequest.v1'
        generated = (Get-Date).ToString('s')
        uri = $Uri
        method = $Method
        status = 'NeedsToken'
        httpStatus = $null
        error = 'Provide -AccessTokenPath with a bearer token file.'
        data = $null
    }
    if ($Json) { $text = $result | ConvertTo-Json -Depth 8; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
    $result
    return
}

try {
    $headers = @{ Authorization = "Bearer $token" }
    $data = Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers -ErrorAction Stop
    $result = [pscustomobject]@{ schema = 'codex.powerbi.fabricReadOnlyRequest.v1'; generated = (Get-Date).ToString('s'); uri = $Uri; method = 'GET'; status = 'Succeeded'; httpStatus = 200; error = $null; data = $data }
}
catch {
    $result = [pscustomobject]@{ schema = 'codex.powerbi.fabricReadOnlyRequest.v1'; generated = (Get-Date).ToString('s'); uri = $Uri; method = 'GET'; status = 'Failed'; httpStatus = $null; error = (Redact-TokenText -Text $_.Exception.Message -Token $token); data = $null }
}

if ($Json) { $text = $result | ConvertTo-Json -Depth 12; if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8 }; $text; return }
$result
