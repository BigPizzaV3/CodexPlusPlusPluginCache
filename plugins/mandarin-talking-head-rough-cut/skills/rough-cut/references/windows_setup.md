# Windows 新用户安装与兼容说明

## 适用范围

- Windows 10 1809（Build 17763）或更新版本；
- 64位 Intel/AMD 处理器；
- 建议内存 16GB 以上；
- 建议工作盘剩余空间 20GB 以上；
- 建议使用 SSD 作为当前剪辑工作区。

本 Skill 不要求独立显卡。存在 NVIDIA 显卡时优先使用 NVENC；驱动或硬件编码不可用时会
自动回退到 CPU 的 libx264，不会因此无法剪辑。

## 最简单的安装方式

解压 Skill 后，让 Codex 或用户在 Skill 目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File ".\scripts\bootstrap_windows.ps1" `
  -ProjectDir "$PWD"
```

安装器会：

1. 检查 Windows 和64位环境；
2. 查找 Python 3.11 x64；
3. 缺少 Python 时通过 WinGet 安装用户级 Python 3.11；
4. 缺少 FFmpeg 时下载官方 FFmpeg 下载页列出的 gyan.dev Windows 构建；
5. 下载后对照发布方的 SHA-256 校验文件，校验失败立即停止；
6. 把 FFmpeg 放进 Skill 自己的 `.tools\ffmpeg\bin`，不依赖重启后才生效的 PATH；
7. 创建独立 `.venv`；
8. 安装核心和可选 Python 依赖；
9. 生成空白 `config.json`，但绝不填写或复制他人的火山密钥；
10. 使用程序生成的测试视频，验证中文路径、FFmpeg和真实成片渲染。

安装器不需要用户手动安装 CUDA。RTX显卡只用于 FFmpeg NVENC 编码，安装有效的 NVIDIA
显卡驱动即可。

## 如果没有 WinGet

WinGet 随 Windows“应用安装程序（App Installer）”提供。可先查看
[微软 WinGet 安装说明](https://learn.microsoft.com/windows/package-manager/winget/)。
Windows 10 1809 以上如果找不到 `winget`：

1. 打开 Microsoft Store；
2. 搜索“应用安装程序”或“App Installer”；
3. 安装或更新；
4. 关闭并重新打开 Codex；
5. 再次运行上面的 `bootstrap_windows.ps1` 命令。

企业电脑无法访问 Microsoft Store 时，让IT安装64位 Python 3.11，并确保
`python.exe` 或 `py.exe` 可用；之后重跑安装脚本即可。

FFmpeg 下载自 [FFmpeg 官方下载页](https://ffmpeg.org/download.html)列出的
[gyan.dev Windows 构建](https://www.gyan.dev/ffmpeg/builds/)，并在解压前核对发布方
提供的 SHA-256。无需另外寻找 DLL、编解码器包或 CUDA Toolkit。

## PowerShell 命令写法

Windows 虚拟环境中的 Python 路径是：

```powershell
$Python = "$SkillDir\.venv\Scripts\python.exe"
```

运行脚本使用调用运算符 `&`：

```powershell
& $Python "$SkillDir\scripts\doctor.py" --allow-no-asr
```

不要照抄 macOS 的：

```text
.venv/bin/python
```

不要在 PowerShell 中使用 Bash 的 `$(cat ...)`、`mkdir -p` 或反斜杠续行。

## 火山配置

Windows 安装器只生成空白模板。按照 `references/volc_asr_setup.md`，使用用户自己的
豆包语音和 TOS 账号填写。配置完成后：

```powershell
& "$SkillDir\.venv\Scripts\python.exe" `
  "$SkillDir\scripts\doctor.py" `
  --config "$SkillDir\config.json"
```

只有显示“环境就绪”才开始自动转写。

## Windows 冒烟测试

```powershell
$SkillDir = "C:\Users\你的用户名\.codex\skills\rough-cut"
$Python = "$SkillDir\.venv\Scripts\python.exe"
$Out = "$SkillDir\workspace\asr-smoke-test\output"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

& $Python "$SkillDir\scripts\probe.py" `
  "D:\素材\测试视频.mp4" `
  --out $Out

& $Python "$SkillDir\scripts\transcribe_pipeline.py" `
  "$Out\audio.wav" `
  --out $Out `
  --config "$SkillDir\config.json"
```

编排脚本会自动完成上传、转写和删除；即使转写失败也会尝试删除临时对象。配置文件仍属于
敏感信息，不要粘贴到聊天中。

## 性能建议

- 原片、工作区和临时文件优先放 SSD；HDD 适合归档，不适合高频中间渲染。
- 1080×1920 口播，32GB内存已经充足。
- NVIDIA 驱动正常时会优先使用 `h264_nvenc`。
- NVENC 失败会自动回退 `libx264`，速度会慢但结果仍可交付。
- 4K或长视频建议保留至少源素材体积 3～5 倍的空闲空间。
- 工作区尽量使用短路径，例如 `D:\VideoWork\任务名`，减少 Windows 超长路径风险。

## 当前边界

- 剪映草稿受剪映版本和 `pyJianYingDraft` 兼容性影响，不是 MP4 成片的必需条件。
- macOS 的 VideoToolbox 不会在 Windows 上调用。
- macOS 系统字体不是必需项；Skill 已自带中文字体。
- 不依赖 Homebrew、Bash、`/usr/local/bin` 或 `/System/Library/Fonts`。
