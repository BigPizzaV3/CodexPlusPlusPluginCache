param(
    [ValidateSet('On', 'Off', 'Toggle', 'Playroom', 'Switch', 'Familiar', 'Exit')]
    [string]$Action = 'Toggle',
    [string]$PetId = '',
    [ValidateSet('P1','P2')]
    [string]$Player = 'P1',
    [ValidateSet('idle','user-active','codex-working','completed','needs-input','permission-required','succeeded','failed','returning-user','celebrate','wait','sleep','greet')]
    [string]$FamiliarEvent = 'idle'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$eventNames = @{
    On = 'Local\WindowispGameModeOn'
    Off = 'Local\WindowispGameModeOff'
    Toggle = 'Local\WindowispGameModeToggle'
    Playroom = 'Local\WindowispPlayroom'
    Switch = 'Local\WindowispSwitch'
    Familiar = 'Local\WindowispFamiliarEvent'
    Exit = 'Local\WindowispGameModeExit'
}

function Send-GameModeSignal([string]$name) {
    try {
        $event = [Threading.EventWaitHandle]::OpenExisting($eventNames[$name])
        try { $event.Set() | Out-Null } finally { $event.Dispose() }
        return $true
    } catch [Threading.WaitHandleCannotBeOpenedException] {
        return $false
    }
}

function Get-ActualUserProfile {
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE) -and
        (Test-Path -LiteralPath $env:USERPROFILE -PathType Container)) {
        return $env:USERPROFILE
    }
    return [Environment]::GetFolderPath('UserProfile')
}

function Get-CodexAppAsarPath {
    foreach ($process in @(Get-Process ChatGPT -ErrorAction SilentlyContinue)) {
        try {
            if ([string]::IsNullOrWhiteSpace($process.Path)) { continue }
            $candidate = Join-Path (Split-Path -Parent $process.Path) 'resources\app.asar'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        } catch {}
    }
    return $null
}

function Get-CodexBuiltInPets {
    $asarPath = Get-CodexAppAsarPath
    if ([string]::IsNullOrWhiteSpace($asarPath)) { return @() }

    $specs = @(
        @('codex','Codex'),
        @('dewey','Dewey'),
        @('fireball','Fireball'),
        @('hoots','Hoots'),
        @('rocky','Rocky'),
        @('seedy','Seedy'),
        @('stacky','Stacky'),
        @('bsod','BSOD'),
        @('null-signal','Null Signal')
    )
    $localAppData = if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $env:LOCALAPPDATA
    } else {
        [Environment]::GetFolderPath('LocalApplicationData')
    }
    $cacheRoot = Join-Path $localAppData 'Windowisp\codex-default-pets'
    New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
    $stream = $null
    try {
        $stream = [IO.File]::Open($asarPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
        $reader = New-Object IO.BinaryReader($stream,[Text.Encoding]::UTF8,$true)
        $null = $reader.ReadUInt32()
        $headerSize = [uint32]$reader.ReadUInt32()
        $null = $reader.ReadUInt32()
        $jsonSize = [uint32]$reader.ReadUInt32()
        if ($headerSize -lt 16 -or $headerSize -gt 67108864 -or $jsonSize -gt ($headerSize - 8)) { throw 'Unsupported Codex app archive header.' }
        $header = ([Text.Encoding]::UTF8.GetString($reader.ReadBytes([int]$jsonSize))) | ConvertFrom-Json
        $assetFiles = $header.files.webview.files.assets.files
        if ($null -eq $assetFiles) { return @() }
        $dataOffset = 8L + [long]$headerSize
        $asarUpdated = (Get-Item -LiteralPath $asarPath).LastWriteTimeUtc
        $builtIns = @()
        foreach ($spec in $specs) {
            $id = [string]$spec[0]; $displayName = [string]$spec[1]
            $assetProperty = @($assetFiles.PSObject.Properties | Where-Object { $_.Name -like "$id-spritesheet-*.webp" } | Select-Object -First 1)
            if ($assetProperty.Count -eq 0) { continue }
            $entry = $assetProperty[0].Value
            $assetSize = [long]$entry.size
            $assetOffset = [long]$entry.offset
            if ($assetSize -le 0 -or ($dataOffset + $assetOffset + $assetSize) -gt $stream.Length) { continue }
            $cachePath = Join-Path $cacheRoot "$id.webp"
            $needsRefresh = $true
            if (Test-Path -LiteralPath $cachePath -PathType Leaf) {
                $cached = Get-Item -LiteralPath $cachePath
                $needsRefresh = $cached.Length -ne $assetSize -or $cached.LastWriteTimeUtc -lt $asarUpdated
            }
            if ($needsRefresh) {
                $stream.Position = $dataOffset + $assetOffset
                $output = $null
                try {
                    $output = [IO.File]::Open($cachePath,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
                    $buffer = New-Object byte[] 81920
                    $remaining = $assetSize
                    while ($remaining -gt 0) {
                        $read = $stream.Read($buffer,0,[int][Math]::Min($buffer.Length,$remaining))
                        if ($read -le 0) { throw "Unexpected end of Codex pet asset: $id" }
                        $output.Write($buffer,0,$read); $remaining -= $read
                    }
                } finally {
                    if ($null -ne $output) { $output.Dispose() }
                }
                (Get-Item -LiteralPath $cachePath).LastWriteTimeUtc = $asarUpdated
            }
            $builtIns += [pscustomobject]@{
                Id = $id
                DisplayName = $displayName
                Source = $cachePath
                Updated = $asarUpdated
                IsPersonal = $false
                IsStarter = $false
                IsBuiltIn = $true
            }
        }
        return $builtIns
    } catch {
        if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { [Console]::Error.WriteLine("diagnostic:codex-default-pets $($_.Exception.Message)") }
        return @()
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Get-CodexPet([string]$requestedId) {
    $petRoot = if (-not [string]::IsNullOrWhiteSpace($env:WINDOWISP_PET_ROOT)) {
        $env:WINDOWISP_PET_ROOT
    } else {
        Join-Path (Get-ActualUserProfile) '.codex\pets'
    }
    $pets = @()
    if (Test-Path -LiteralPath $petRoot -PathType Container) {
        foreach ($manifestPath in Get-ChildItem -LiteralPath $petRoot -Filter pet.json -File -Recurse -ErrorAction SilentlyContinue) {
            try {
                $manifest = Get-Content -LiteralPath $manifestPath.FullName -Raw | ConvertFrom-Json
                if ([int]$manifest.spriteVersionNumber -ne 2) { continue }
                if ([string]::IsNullOrWhiteSpace([string]$manifest.spritesheetPath)) { continue }
                $source = Join-Path $manifestPath.DirectoryName ([string]$manifest.spritesheetPath)
                if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
                $pets += [pscustomobject]@{
                    Id = [string]$manifest.id
                    DisplayName = $(if ($manifest.displayName) { [string]$manifest.displayName } else { [string]$manifest.id })
                    Source = (Resolve-Path -LiteralPath $source).Path
                    Updated = $manifestPath.LastWriteTimeUtc
                    IsPersonal = $true
                    IsStarter = $false
                    IsBuiltIn = $false
                }
            } catch {
                continue
            }
        }
    }

    foreach ($builtInPet in @(Get-CodexBuiltInPets)) {
        if (-not ($pets | Where-Object { $_.Id -eq $builtInPet.Id })) { $pets += $builtInPet }
    }

    # Caiuto Cub ships with Windowisp so a first-time player can start
    # immediately. Personal pets remain preferred whenever they are available.
    $starterManifestPath = Join-Path $PSScriptRoot 'assets\caiuto-cub\pet.json'
    if (Test-Path -LiteralPath $starterManifestPath -PathType Leaf) {
        try {
            $starterManifest = Get-Content -LiteralPath $starterManifestPath -Raw | ConvertFrom-Json
            $starterSource = Join-Path (Split-Path -Parent $starterManifestPath) ([string]$starterManifest.spritesheetPath)
            if ([int]$starterManifest.spriteVersionNumber -eq 2 -and (Test-Path -LiteralPath $starterSource -PathType Leaf) -and -not ($pets | Where-Object { $_.Id -eq [string]$starterManifest.id })) {
                $pets += [pscustomobject]@{
                    Id = [string]$starterManifest.id
                    DisplayName = $(if ($starterManifest.displayName) { [string]$starterManifest.displayName } else { [string]$starterManifest.id })
                    Source = (Resolve-Path -LiteralPath $starterSource).Path
                    Updated = [DateTime]::MinValue
                    IsPersonal = $false
                    IsStarter = $true
                    IsBuiltIn = $false
                }
            }
        } catch {}
    }

    if ($pets.Count -eq 0) {
        throw 'No compatible v2 pet was found and the Windowisp starter pet is missing. Reinstall Windowisp.'
    }

    if (-not [string]::IsNullOrWhiteSpace($requestedId)) {
        $selected = @($pets | Where-Object { $_.Id -eq $requestedId -or $_.DisplayName -eq $requestedId })
        if ($selected.Count -eq 0) {
            $available = ($pets | ForEach-Object { $_.Id }) -join ', '
            throw "Pet '$requestedId' was not found. Available pets: $available"
        }
        return $selected[0]
    }

    $personalPets = @($pets | Where-Object { $_.IsPersonal } | Sort-Object Updated -Descending)
    if ($personalPets.Count -gt 0) { return $personalPets[0] }
    $codexDefault = @($pets | Where-Object { $_.IsBuiltIn -and $_.Id -eq 'codex' } | Select-Object -First 1)
    if ($codexDefault.Count -gt 0) { return $codexDefault[0] }
    return @($pets | Where-Object { $_.IsStarter } | Select-Object -First 1)[0]
}

function Find-CodexPython {
    $profile = Get-ActualUserProfile
    $preferred = Join-Path $profile '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $preferred -PathType Leaf) { return $preferred }

    $runtimeRoot = Join-Path $profile '.cache\codex-runtimes'
    if (Test-Path -LiteralPath $runtimeRoot -PathType Container) {
        $candidate = Get-ChildItem -LiteralPath $runtimeRoot -Filter python.exe -File -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\dependencies\\python\\python\.exe$' } |
            Select-Object -First 1
        if ($null -ne $candidate) { return $candidate.FullName }
    }
    throw 'Codex image runtime was not found. Open Codex, then try Game Mode again.'
}

function Get-WpfPetAtlas($pet) {
    if ([IO.Path]::GetExtension($pet.Source) -ieq '.png') { return $pet.Source }

    $localAppData = if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $env:LOCALAPPDATA
    } else {
        [Environment]::GetFolderPath('LocalApplicationData')
    }
    $cacheRoot = Join-Path $localAppData 'Windowisp\pet-cache'
    New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
    $safeId = $pet.Id -replace '[^a-zA-Z0-9._-]', '_'
    $cachedAtlas = Join-Path $cacheRoot "$safeId.png"
    $sourceInfo = Get-Item -LiteralPath $pet.Source
    if ((Test-Path -LiteralPath $cachedAtlas -PathType Leaf) -and
        ((Get-Item -LiteralPath $cachedAtlas).LastWriteTimeUtc -ge $sourceInfo.LastWriteTimeUtc)) {
        return $cachedAtlas
    }

    $converter = Join-Path $PSScriptRoot 'scripts\prepare-pet-atlas.py'
    $python = Find-CodexPython
    & $python $converter --source $pet.Source --output $cachedAtlas
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $cachedAtlas -PathType Leaf)) {
        throw "Could not prepare pet '$($pet.DisplayName)' for Game Mode."
    }
    return $cachedAtlas
}

if ($Action -eq 'Switch') {
    if ([string]::IsNullOrWhiteSpace($PetId)) { throw 'Switch requires a PetId.' }
    $pet = Get-CodexPet $PetId
    $atlasPath = Get-WpfPetAtlas $pet
    $localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { [Environment]::GetFolderPath('LocalApplicationData') }
    $requestRoot = Join-Path $localAppData 'Windowisp'
    New-Item -ItemType Directory -Path $requestRoot -Force | Out-Null
    $requestPath = Join-Path $requestRoot 'pet-switch.json'
    @{ id=$pet.Id; displayName=$pet.DisplayName; atlasPath=$atlasPath; player=$Player } | ConvertTo-Json | Set-Content -LiteralPath $requestPath -Encoding UTF8
    if (Send-GameModeSignal 'Switch') {
        Write-Output "Switched $Player desktop pet to $($pet.DisplayName)."
        exit 0
    }
    $Action = 'On'
}

if($Action-eq'Familiar'){
    $localAppData=if($env:LOCALAPPDATA){$env:LOCALAPPDATA}else{[Environment]::GetFolderPath('LocalApplicationData')}
    $requestRoot=Join-Path $localAppData 'Windowisp';New-Item -ItemType Directory -Path $requestRoot -Force|Out-Null
    @{event=$FamiliarEvent;createdUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $requestRoot 'familiar-event.json') -Encoding UTF8
    if(Send-GameModeSignal 'Familiar'){Write-Output "Familiar event sent: $FamiliarEvent.";exit 0}
}

if (-not (Send-GameModeSignal $Action)) {
    if ($Action -in @('Off', 'Exit')) {
        Write-Output 'The desktop pet is already closed.'
        exit 0
    }

    $pet = Get-CodexPet $PetId
    $atlasPath = Get-WpfPetAtlas $pet
    $petScript = Join-Path $PSScriptRoot 'run-pet.ps1'
    $arguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$petScript`"",
        '-AtlasPath', "`"$atlasPath`"",
        '-PetId', "`"$($pet.Id)`"",
        '-PetName', "`"$($pet.DisplayName)`""
    )
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') {
        $diagnosticOut = Join-Path $PSScriptRoot 'windowisp-diagnostic.out'
        $diagnosticErr = Join-Path $PSScriptRoot 'windowisp-diagnostic.err'
        Start-Process powershell.exe -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $diagnosticOut -RedirectStandardError $diagnosticErr | Out-Null
    } else {
        Start-Process powershell.exe -ArgumentList $arguments -WindowStyle Hidden | Out-Null
    }

    $sent = $false
    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 100
        $launchSignal=$(if($Action-eq'Playroom'){'Playroom'}elseif($Action-eq'Familiar'){'Familiar'}else{'On'})
        if (Send-GameModeSignal $launchSignal) { $sent = $true; break }
    }
    if (-not $sent) { throw 'The desktop pet did not start in time.' }
    Write-Output $(if($Action-eq'Playroom'){"Sandbox Mode started with $($pet.DisplayName)."}elseif($Action-eq'Familiar'){"Windowisp started and Familiar event sent: $FamiliarEvent."}else{"Game Mode started with $($pet.DisplayName)."})
} else {
    Write-Output "Game Mode command sent: $Action."
}
