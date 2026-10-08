param(
    [string]$ProjectDir = "",
    [switch]$SkipOptional
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$env:PYTHONUTF8 = "1"

$SkillRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
    $ProjectDir = $SkillRoot
}
$ProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)

function Write-Step([string]$Text) {
    Write-Host "`n== $Text ==" -ForegroundColor Cyan
}

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Resolve-Python311 {
    $candidates = @()
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        try {
            $resolved = (& $py.Source -3.11 -c "import sys; print(sys.executable)" 2>$null)
            if ($LASTEXITCODE -eq 0 -and $resolved) {
                $candidates += $resolved.Trim()
            }
        } catch {}
    }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) {
        $candidates += $python.Source
    }
    $candidates += @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"),
        "C:\Program Files\Python311\python.exe"
    )
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path $candidate)) { continue }
        try {
            & $candidate -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) and sys.maxsize > 2**32 else 1)"
            if ($LASTEXITCODE -eq 0) { return $candidate }
        } catch {}
    }
    return $null
}

if (-not $IsWindows -and $env:OS -ne "Windows_NT") {
    throw "此脚本只用于 Windows。macOS/Linux 请按 references/runtime.md 安装。"
}
if (-not [Environment]::Is64BitOperatingSystem) {
    throw "只支持64位Windows；当前检测到32位系统。"
}
$build = [Environment]::OSVersion.Version.Build
if ($build -lt 17763) {
    throw "需要 Windows 10 1809（Build 17763）或更新版本；当前 Build $build。"
}

Write-Step "检查 Python 3.11 x64"
$Python = Resolve-Python311
if (-not $Python) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw @"
未找到 Python 3.11，也没有 WinGet。
请先从 Microsoft Store 安装/更新“应用安装程序（App Installer）”，重新打开 Codex，
然后按 references\windows_setup.md 再次运行本 PowerShell 安装命令。
"@
    }
    & $winget.Source install --id Python.Python.3.11 -e --scope user `
        --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "WinGet 安装 Python 3.11 失败（退出码 $LASTEXITCODE）。"
    }
    Refresh-ProcessPath
    $Python = Resolve-Python311
    if (-not $Python) {
        throw "Python 已安装但当前进程尚未找到。请关闭并重新打开 Codex后再次运行安装脚本。"
    }
}
Write-Host "Python: $Python"

Write-Step "安装 Skill 本地 FFmpeg"
$FfmpegBin = Join-Path $SkillRoot ".tools\ffmpeg\bin"
$LocalFfmpeg = Join-Path $FfmpegBin "ffmpeg.exe"
$LocalFfprobe = Join-Path $FfmpegBin "ffprobe.exe"
if (-not ((Test-Path $LocalFfmpeg) -and (Test-Path $LocalFfprobe))) {
    $systemFfmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
    $systemFfprobe = Get-Command ffprobe.exe -ErrorAction SilentlyContinue
    if ($systemFfmpeg -and $systemFfprobe) {
        Write-Host "使用系统 FFmpeg: $($systemFfmpeg.Source)"
    } else {
        $downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
            "rough-cut-ffmpeg-" + [Guid]::NewGuid().ToString("N"))
        $archive = Join-Path $downloadRoot "ffmpeg.zip"
        $expanded = Join-Path $downloadRoot "expanded"
        New-Item -ItemType Directory -Force -Path $downloadRoot, $expanded, $FfmpegBin | Out-Null
        $url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
        $hashUrl = "$url.sha256"
        Write-Host "下载 Windows FFmpeg（官方 FFmpeg 下载页列出的 gyan.dev 构建）..."
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive
        $expectedHash = (
            Invoke-WebRequest -UseBasicParsing -Uri $hashUrl
        ).Content.Trim().Split()[0].ToLowerInvariant()
        $actualHash = (Get-FileHash -Algorithm SHA256 -Path $archive).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash) {
            throw "FFmpeg 下载文件 SHA-256 校验失败，已停止安装。"
        }
        Write-Host "FFmpeg SHA-256 校验通过。"
        Expand-Archive -Path $archive -DestinationPath $expanded -Force
        $found = Get-ChildItem -Path $expanded -Filter ffmpeg.exe -Recurse |
            Select-Object -First 1
        if (-not $found) { throw "下载包中没有找到 ffmpeg.exe。" }
        Copy-Item -Path (Join-Path $found.DirectoryName "*") -Destination $FfmpegBin -Force
    }
}

Write-Step "创建独立 Python 虚拟环境"
New-Item -ItemType Directory -Force -Path $ProjectDir | Out-Null
$Venv = Join-Path $ProjectDir ".venv"
$VenvPython = Join-Path $Venv "Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    & $Python -m venv $Venv
    if ($LASTEXITCODE -ne 0) { throw "创建虚拟环境失败。" }
}

Write-Step "安装全部 Python 依赖"
& $VenvPython -m pip install --upgrade pip setuptools wheel
if ($LASTEXITCODE -ne 0) { throw "升级 pip 失败。" }
& $VenvPython -m pip install -r (Join-Path $SkillRoot "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "安装核心依赖失败。" }
if (-not $SkipOptional) {
    & $VenvPython -m pip install -r (Join-Path $SkillRoot "requirements-optional.txt")
    if ($LASTEXITCODE -ne 0) { throw "安装可选剪映草稿依赖失败。" }
}

Write-Step "生成用户自己的火山配置模板"
$ConfigPath = Join-Path $ProjectDir "config.json"
if (-not (Test-Path $ConfigPath)) {
    & $VenvPython (Join-Path $PSScriptRoot "init_config.py") --out $ConfigPath
} else {
    Write-Host "保留已有配置，不覆盖：$ConfigPath"
}

Write-Step "运行离线环境体检"
$doctorArgs = @(
    (Join-Path $PSScriptRoot "doctor.py"),
    "--allow-no-asr"
)
if (-not $SkipOptional) { $doctorArgs += "--require-optional" }
& $VenvPython @doctorArgs
if ($LASTEXITCODE -ne 0) { throw "环境体检失败，请查看上面的红色/叉号项目。" }
& $VenvPython (Join-Path $PSScriptRoot "probe.py") --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw "probe.py 启动检查失败。" }
& $VenvPython (Join-Path $PSScriptRoot "selftest.py")
if ($LASTEXITCODE -ne 0) { throw "跨平台真实渲染自检失败。" }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "本地剪辑环境安装完成" -ForegroundColor Green
Write-Host "Python: $VenvPython"
if (Test-Path $LocalFfmpeg) {
    Write-Host "FFmpeg: $LocalFfmpeg"
}
Write-Host "配置模板: $ConfigPath"
Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "1. 阅读 references\volc_asr_setup.md"
Write-Host "2. 在本地编辑 config.json，填写用户自己的火山ASR和TOS凭证"
Write-Host "3. 不要把密钥粘贴给Agent"
Write-Host "4. 填完后运行："
Write-Host "& `"$VenvPython`" `"$PSScriptRoot\doctor.py`" --config `"$ConfigPath`""
Write-Host "========================================`n" -ForegroundColor Green
