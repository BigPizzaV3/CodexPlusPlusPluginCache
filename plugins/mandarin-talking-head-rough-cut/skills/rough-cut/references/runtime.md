# 安装与运行约定

## Agent 第一次使用时

1. 把本 Skill 目录记为 `SKILL_DIR`，不要依赖固定安装位置或当前工作目录。
2. 先识别操作系统。Windows必须改读 `references/windows_setup.md` 并运行
   `scripts\bootstrap_windows.ps1`；下面的 Bash 命令只用于 macOS/Linux。
3. macOS/Linux在承载剪辑任务的项目目录创建 `.venv`：

   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r "$SKILL_DIR/requirements.txt"
   ```

4. macOS 若没有 ffmpeg/ffprobe，运行 `brew install ffmpeg`；Linux使用系统包管理器。
5. 读取 `references/volc_asr_setup.md`。如果用户第一次使用火山，必须先按其中
   “Agent 首次配置带领方式”逐步引导用户完成账号、语音服务和 TOS；不得只抛出字段
   清单。用户取得所需信息后，才在任务目录生成自己的空白配置：

   ```bash
   .venv/bin/python "$SKILL_DIR/scripts/init_config.py" --out ./config.json
   ```

   用户必须填写自己的火山 ASR 和 TOS 账号；不得复用其他用户的配置。
6. 运行：

   ```bash
   .venv/bin/python "$SKILL_DIR/scripts/doctor.py" --config ./config.json
   .venv/bin/python "$SKILL_DIR/scripts/probe.py" --help
   ```

没有自己的火山配置，首次安装体检不会通过。只有任务已经带有合格的逐字稿和词级时间戳、
明确不调用ASR时，才可以使用 `doctor.py --allow-no-asr` 检查后续剪辑环境。

## 火山配置

优先使用 `scripts/init_config.py` 生成当前任务的空白配置并填写自己的账号。也可把配置
放在任意安全位置，然后：

```bash
export ROUGH_CUT_CONFIG="/安全位置/config.json"
```

或对 `upload_tos.py`、`transcribe_volc.py` 传 `--config`。真实密钥不能写进 Skill、
剪辑报告、命令输出或安装包。

## 路径与产物

- 原片只读；所有产物写入任务工作区的 `output/`。
- 命令中的 `scripts/...` 是相对于 `SKILL_DIR`；从别处运行时使用绝对脚本路径。
- Windows虚拟环境入口是 `.venv\Scripts\python.exe`，不是 `.venv/bin/python`。
- 品牌计划里的相对字体路径会按“当前目录 → Skill 目录”解析。
- Skill 只内置许可允许再分发的开源字体。用户可为当前任务指定自己有权使用的字体；
  不得把用户字体写回 Skill 或重新打包分发。

## 能力边界

- 核心必需：Python 3.10+、ffmpeg、ffprobe、numpy、Pillow、jieba、tos。
- 剪映草稿是可选能力，且受剪映版本兼容性限制；需要时另装
  `requirements-optional.txt`。
- B-roll 自动选材/布局未实现；没有用户提供素材时不要伪装成已完成。
- 标题连续入场动画和语义图标渲染不是当前完成标准；编译清单中的
  `renderer_pending` 必须如实保留。
