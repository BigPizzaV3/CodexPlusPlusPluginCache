---
name: rough-cut
description: 剪辑中文单人或轻对谈口播视频：通过词级时间轴清理前摇、口误、NG、多 take、重复、语气词和场外插话，复查逻辑后精确渲染 MP4；还可添加通用字幕、主题与身份包装、花字、推近、故事暗角、引语滤镜、BGM、定点音效和剪辑报告。用户要求口播粗剪、去废话、字幕包装或完整后期时使用。
---

# 口播粗剪流程（timeline.md 改文字机制）

按顺序执行。真值有两份：`segments.json`（词级时间，机器读）＋`timeline.md`（转写稿，
④在上面剪）。只有第④步动脑，其余调脚本。目标不是只抠几个口水词，而是删干净前摇、
收工、作废 take、过程话、真重复和不回收的跑题，同时守住连接骨架和原意。

## 运行约定

把本文件所在目录记为 `SKILL_DIR`，把任务产物目录记为 `OUT`。实际命令必须使用 Skill
目录中的脚本，不依赖当前工作目录：

- Windows：`PYTHON=<venv>\Scripts\python.exe`；首次使用先读
  `references/windows_setup.md`，按其中命令运行 `scripts\bootstrap_windows.ps1`。
- macOS/Linux：`PYTHON=<venv>/bin/python`；首次使用先读 `references/runtime.md`。

开始前运行：

```text
<PYTHON> <SKILL_DIR>/scripts/doctor.py --config <CONFIG>
<PYTHON> <SKILL_DIR>/scripts/probe.py --help
```

自动转写前还必须读 `references/volc_asr_setup.md`。如果检测到用户尚未配置火山，立即
进入该文档的“Agent 首次配置带领方式”，把它当作交互式开户向导执行，不得只列字段后让
用户自行研究：

1. 先用生活化语言说明为什么需要豆包语音和临时 TOS，不先抛出 `resource_id`、AK/SK、
   Endpoint 等实现术语。
2. 一次只布置一个明确动作，并等用户完成或发截图后再讲下一步：注册/实名 → 开通录音
   识别 → 取得语音鉴权 → 创建私有桶 → 取得 TOS 密钥 → 本地填写 → 体检。
3. 每一步说明“打开哪里、点什么、完成后应看到什么、如何回复”；界面不同时让用户发不含
   密钥的截图，Agent根据截图继续指路。
4. 在用户取得所需服务和凭证之前，不让用户打开 `config.json`，也不发送整张工程字段表。
5. 首次阻塞回复优先解决开户，不用大段硬件、编码器和内部流水线状态淹没用户。

安装者只能使用自己的火山 ASR 和 TOS 配置；不得搜索、复制、输出或复用他人的
`config.json`，也不得让用户把密钥粘贴到聊天中。任务已有合格词级转写并明确跳过转写
时，环境检查可加 `--allow-no-asr`。

## 硬性规则

1. 原片只读；所有中间文件和成片写入 `OUT`，绝不覆盖原片。
2. 音视频处理只调用 `scripts/` 中的现成脚本；不得临时拼 FFmpeg 或音频命令。
3. 删减只在 `timeline.md` 上裁决，不手猜毫秒时间码。
4. 删除完整语义块；句内划删必须逐词兑现，不能留下半句或切断字尾。
5. 拿不准就保留，并在行尾标 `%待确认：理由%`。
6. 渲染前必须完成剪后逐字稿通读；渲染后必须抽听所有删除接口。
7. 带货和引流内容必须执行合规检查；合规要求优先于 keep-biased。
8. 脚本失败就停止并说明失败步骤和错误，不反复破坏性重试。
9. **病句不等于无效内容。** 主讲人句子即使有口误、ASR 错字或量词重复，只要包含独有的
   方法、步骤、人物身份、数字、例子、因果或承接信息，就必须优先局部划删并保留信息骨架；
   不得因为删后“大意还能接上”而整句删除。
10. 自动转写会把抽取音频临时上传到用户自己的 TOS，并交由火山语音识别处理，可能产生
    存储、流量和识别费用。每个任务首次上传前说明数据流、尽力删除但可能需要人工清理的
    边界，并取得用户确认；用户提供合格词级转写时优先使用本地流程。

## 主流程

主交付是 `preview.mp4` 和 `剪辑报告.md`。字幕、包装、音效和剪映草稿属于可选交付。

### 1. 探测原片并抽音频

```text
<PYTHON> <SKILL_DIR>/scripts/probe.py <VIDEO> --out <OUT>
```

确认生成 `meta.json` 和 16kHz 单声道 `audio.wav`。

### 2. 生成词级转写

```text
<PYTHON> <SKILL_DIR>/scripts/transcribe_pipeline.py <OUT>/audio.wav \
  --out <OUT> --config <CONFIG>
```

该脚本负责上传到用户自己的 TOS、调用火山 ASR、写入 `transcript.json`，并在成功或失败
后尝试删除临时对象。必须取得逐句文字和词级时间戳；缺失时停止。

### 3. 生成文字剪辑稿

```text
<PYTHON> <SKILL_DIR>/scripts/build_timeline.py <OUT>/transcript.json --out <OUT>
```

确认生成 `segments.json`（机器时间真值）和 `timeline.md`（内容裁决稿）。

### 4. 编辑 `timeline.md`

编辑语法：

- 删词：`[s5] 这一句~~呢~~话`
- 删句：删除整行
- 重排：移动整行
- 编导或非主讲人：删除整行或加 `@编导`
- 存疑：行尾加 `%待确认：理由%` 并保留

开始裁决前必须读取 `timeline.md` 和：

- `references/koubo_logic.md`：通用口播结构、说话意图、NG 与场外提示信号；
- `references/editing_rules.md`：删留、承接、重复和连接骨架；
- `references/filler_rules.md`：语气词和口水词；
- 引流、卖课、卖货、导直播间时额外读 `references/conversion_video_patterns.md`。

**按四关做，不得跳步：**

1. **说话人过滤**
   - 先判断是单人口播还是与编导/嘉宾对谈。
   - 编导的“对对、是是是、叫什么”本身默认不进成片，但删除前必须先读懂它携带的剪辑
     信号。
   - “重来一遍、最后一句再来、这条不行、最好也不行”表示前面的 take 已作废；必须回头
     删除作废版、保留后面的干净重录版，不能只删编导提示却把作废内容留下。

2. **找真正话头和话尾**
   - 真话头应当是设问、观点、现象钩子或金句前置；它之前的试麦、对词、暖场和找状态
     全部删除。
   - 找到最后一句能完整收束主题的话；它之后的“好了吧、这条过了、就这样”和继续闲聊
     全部删除。
   - 前摇和收工常占原片 20%～35%，不能只删几个语气词就算完成。

3. **归纳主线**
   - 在裁决跑题前，先写出一句话主题和从话头到话尾的要点链。
   - 某段只有推进主题、提供新论据、举例或完成回收时才保留。
   - 同一意思换说法原地打转、偏离后不回收、只服务录制现场而不服务观众的内容删除。
   - 判断“重复”前先做**信息增量检查**：分别列出相邻句中的方法、步骤、限定条件、人物
     身份、数据、例子、因果和承接作用。只有后一句完整覆盖前一句的全部有效信息，才允许
     整句选优删除；“怎么找到人 → 找到后怎么聊”这类相邻步骤不是重复。
   - 不得设定目标时长、目标删减比例或“合格压缩区间”，也不得根据历史成片比例倒推还
     要删多少。有效论证、必要背景、让观点成立的例子和连接骨架必须优先保留；删减比例
     只能在裁决完成后作为描述性统计。

4. **逐句清理**
   - 对 `timeline.md` 的**每一句**都逐项检查，不能只处理大块废段：
     - NG、多 take、说错重说：选信息完整、声音干净、表达自然的一条，其余整句删除；
     - 被“不对、等下、我重说、又讲偏了”推翻的内容：删被推翻版本，留纠正后的版本；
       作废范围只覆盖信号直接指向的未完成句或当前 take，不得向前扩大删除已经完整成立的
       方法、人物身份、案例背景或承接句。
     - 跑题：先确认后文没有回收；确实不回收才删除；
     - 主讲人的过程话和盘算话：如“想想啊、这么讲、对啊是是是、开头就用那个、接下来
       讲什么”，一律删除；
     - 同义两句：留更完整、更干净、更能独立成句的一条；夹着编导声或重叠声的版本优先
       删除；
     - 句内语气词、磕巴、假起头和机械重复：用 `~~ ~~` 逐词清理，不得只在文字上改写
       却让错误原声留在成片。
   - 删除前必须读前后 2～3 句，判断她此刻是在“讲给观众”还是“讲给自己”。讲给自己
     的录制过程话，即使单句看似通顺也要删除。
   - 删除完整语义块，不删半句。句内划删必须逐词兑现。
   - 遇到字面病句时，按“确认是否 ASR 错字 → 拆出仍成立的语义块 → 只划删错误起头、
     口误或重复词 → 做承接测试”的顺序处理。病句里的人物资历、信息来源、寻找渠道、
     个性化背景和后文因果落点默认属于信息骨架，不能随病句一起清空。
   - 主讲人整句删除前必须回答两问：“后文哪一句完整覆盖它？”“删除会不会丢失一个
     可单独复述的新事实或新步骤？”第二问为“会”、第一问答不出时，不得整句删除；
     局部无法安全清理就保留并标 `%待确认：病句含独有信息%`。
   - 每一处删除都做承接测试：把删除前一句结尾和删除后一句开头连起来读，主语、指代、
     转折和论证关系必须仍然成立。
   - 磕巴句里如果包含下一句需要的主语、指代或连接词，只清理磕巴，保留连接骨架。
   - 带货/引流口播必须清理广告法绝对化用语；有合规重录版就删违规版、留重录版。
   - 拿不准是否属于有效信息时保留并标 `%待确认：理由%`；但明确的过程话、作废 take、
     真重复、收工、前摇和不回收跑题不得以“保守”为理由漏删。

裁决时按需要生成：

- `corrections.json`：ASR 错字和品牌名纠正；
- `emphasis_plan.json`：少量语义重点词及颜色；
- `zoom.json`：结论、金句或 CTA 的克制推近计划。

### 5. 通读剪后逐字稿

```text
<PYTHON> <SKILL_DIR>/scripts/review_readthrough.py \
  <OUT>/timeline.md <OUT>/segments.json
```

剪的时候想的是“删什么”，观众听到的是“删完后剩下的连读”。必须真的从头到尾阅读脚本
打印的成片逐字稿，并逐项检查：

1. 逻辑是否顺；有没有删掉背景、主语或指代后，让下一句凭空蹦出来；
2. “所以、但是、然后、这、那、他”等连接和指代是否仍有明确落点；
3. 有没有删过头，导致完整观点、卖点、论据或连接骨架丢失；
4. 有没有漏掉明确的口误、磕巴、假起头、重复词、过程话、编导场外话和作废 take；
   对每句句首的“对、然后、那、其实、就是、所以、但是、嗯、啊”必须结合上一句逐个做
   承接测试：有明确回应或逻辑关系才留；无承接对象、停顿后重启表达、删除后更顺的按
   口水词或磕巴删除；
5. 每个分句的主谓宾和修饰关系是否字面成立；不能因为“猜得到她想说什么”就放过病句；
6. 播放顺序是否仍是一条主题线；开头是否有钩子，结尾是否完整收束；
7. 带货/引流内容的绝对化用语和合规问题是否已经清理；
8. 整体是否仍像本人自然说话，而不是被切成机器人。
9. **信息损失审计**：把原稿中被整句删除的主讲人内容再扫一遍。凡是含具体方法、渠道、
   人物身份、数字、案例、限定条件、因果或个性化背景的句子，必须指出成片中哪一句覆盖了
   它；无法指出就返回第④步，恢复有效骨架后只清理口误。

发现任何问题就返回第④步修改 `timeline.md`，然后重新运行本步骤。至少完成两轮：
第一轮检查结构与逻辑，第二轮逐句扫漏清和病句；另做一次被删主讲人内容的信息损失审计。
三项都无硬伤才允许生成切割清单。

### 6. 生成切割清单

```text
<PYTHON> <SKILL_DIR>/scripts/render_from_timeline.py \
  <OUT>/timeline.md <OUT>/segments.json <OUT>/audio.wav --out <OUT>
```

确认生成 `final_cuts.json`。字尾被截时，只能依据听感用
`--boundary-overrides <OUT>/boundary_overrides.json` 做受边界保护的局部补偿；不得手改
毫秒切点或全局放宽所有接口。

### 7. 渲染 MP4

```text
<PYTHON> <SKILL_DIR>/scripts/render_preview.py \
  <VIDEO> <OUT>/final_cuts.json --out <OUT> [--zoom <OUT>/zoom.json]
```

确认生成 `preview.mp4` 和 `render_offsets.json`。默认使用硬切和短音频淡化；只有用户明确
要求柔和转场时才用 `--transition crossfade`。逐个抽听删除接口，发现切字或带回废话就
修正边界并重新渲染。

### 8. 生成报告

```text
<PYTHON> <SKILL_DIR>/scripts/make_report.py <OUT> --out <OUT>
```

确认生成 `剪辑报告.md`，包含删减情况、待确认项和成片位置。

## 可选交付

### 字幕、主题与人物身份包装

需要字幕时运行：

```text
<PYTHON> <SKILL_DIR>/scripts/make_subtitles.py \
  <VIDEO_IN> <OUT>/final_cuts.json <OUT>/transcript.json <OUT>/segments.json \
  --out <OUT> [--emphasis-plan <OUT>/emphasis_plan.json] \
  [--corrections <OUT>/corrections.json] [--brand-plan <OUT>/brand_plan.json] \
  [--subtitle-overrides <OUT>/subtitle_overrides.json]
```

默认使用 Skill 内的开源字体和通用字幕规格。需要主题大字或人物名牌时先读
`references/brand_overlays.md`。必须逐条通读脚本生成的 `字幕审查.md`；只调整分页的
`subtitle_overrides.json` 必须逐字守恒，数字、单位、百分号和英文词组不得拆开。

### 完整视觉后期

用户要求花字、章节、推近、故事暗角、引语滤镜或完整包装时，读取：

- `references/postproduction_modules.md`：执行规范、模块和计划格式；
- `references/postproduction_design.md`：通用视觉、听觉条件规则。

根据最终逐字稿生成 `postproduction_plan.json`，然后依次执行：

```text
<PYTHON> <SKILL_DIR>/scripts/validate_postproduction_plan.py <OUT>/postproduction_plan.json
<PYTHON> <SKILL_DIR>/scripts/compile_postproduction_plan.py \
  <OUT>/postproduction_plan.json --out <OUT>
<PYTHON> <SKILL_DIR>/scripts/apply_visual_filters.py \
  <OUT>/preview.mp4 <OUT>/visual_plan.json --out <OUT>
```

先渲染底层画面滤镜，再叠主题、花字和字幕，最后混音。`postproduction_manifest.json`
中标为 `renderer_pending` 的模块只能报告为待实现，不能声称已经渲染。B-roll 仅在用户
提供或明确指定素材时处理。

### BGM 与定点音效

需要配乐或音效时先读 `references/audio_mix.md`，生成并验证 `audio_plan.json`：

```text
<PYTHON> <SKILL_DIR>/scripts/mix_bgm_sfx.py \
  <VIDEO_IN> <OUT>/audio_plan.json --out <OUT> --dry-run
<PYTHON> <SKILL_DIR>/scripts/mix_bgm_sfx.py \
  <VIDEO_IN> <OUT>/audio_plan.json --out <OUT>
```

人声优先。音乐风格与议题不匹配时宁可不加；不要用 BGM 掩盖底噪，音效只落在明确语义
触发点。

### 剪映草稿

只有用户明确需要且剪映版本兼容时运行：

```text
<PYTHON> <SKILL_DIR>/scripts/make_draft.py \
  <VIDEO> <OUT>/final_cuts.json --out <OUT> --name <TASK_NAME>
```

剪映草稿不是主交付，失败不影响 MP4 成片。

## 开发与规则标定工具

以下工具不属于每条视频的正常剪辑流程：

- `scripts/selftest.py`：安装或升级后验证路径、FFmpeg、渲染、视觉滤镜和音效混音；
- `scripts/analyze_paired_effects.py`：对齐原片与编导成片，反向分析后期变化；
- `scripts/analyze_reference_effects.py`：对参考成片抽帧并匹配本地音效候选；
- `scripts/upload_tos.py`、`scripts/transcribe_volc.py`：转写底层模块和人工排错入口；
- `scripts/snap_cuts.py`：旧切点兼容工具，不进入当前 timeline 主流程。

分析结果只能用于补充证据；低置信度音效或视觉匹配不得硬认。更新规则时只把可迁移的普遍
规律写入 `references/`，不要写入某条素材的具体剪辑答案。

## 完成标准

交付前确认：

- 原片未修改；
- 剪后逐字稿已通读；
- 所有删除接口已抽听；
- `preview.mp4` 可播放且音画正常；
- `剪辑报告.md` 已生成；
- 用户要求的字幕、包装或音效版本已完成全量审查；
- 待确认内容带时间点列出。

向用户汇报：删掉了哪些结构和口误、成片时长、待确认数量及时间点、最终 MP4 路径。
