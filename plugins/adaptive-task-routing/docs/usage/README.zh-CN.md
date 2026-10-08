# Adaptive Task Routing — 使用指南

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

**先知道下一步怎么做，也知道何时值得维持现状。**

Adaptive Task Routing 在重要工作阶段开始前，评估对话环境、模型与推理设置。先显示现在建议的动作，再用一句话解释原因。适合任务的模型，不代表工作进行到一半就值得切换。

判断会考虑任务需求、当前设置是否足够、剩余工作量、对话延续与切换成本。保留合适的设置也是正式结果；信息不足时会说“暂时沿用”，不声称已确认适合。实际节省与可靠性改善仍需要证据。

## 运作方式

1. AI 先交付你要求的发现，或提出可执行计划。
2. 路由区块先显示动作：保持、暂时沿用、新建对话、调整设置，或请你决定。启用对话路由时，仍明确回答是否需要新建对话。
3. 默认 `ask` 在变更前或遇到关键阻碍时询问；保留和不妨碍进度的不确定性，不中断已授权工作。只要求计划不等于授权实施。

简短问题与未改变的阶段不重复路由。对话与模型独立判断；转到新对话时也可能需要调整模型。

## 安装

### Gemini CLI

```bash
gemini extensions install https://github.com/zyzdev/adaptive-task-routing-gemini --ref v0.5.0
```

安装完成后，请重新启动 Gemini CLI。

### Claude Code

公开目录申请正在审核中。正式上架前，可克隆专用仓库并通过插件目录启动 Claude Code：

```bash
git clone --branch v0.5.0 https://github.com/zyzdev/adaptive-task-routing-claude.git
claude --plugin-dir "$PWD/adaptive-task-routing-claude"
```

### ChatGPT 和 Codex

从 [v0.5.0 Release](https://github.com/zyzdev/adaptive-task-routing/releases/tag/v0.5.0) 下载 `adaptive-task-routing-openai-0.5.0.zip`。如果当前界面支持本地插件，请解压后通过插件或 Marketplace 功能添加。公开目录是否可用仍取决于 OpenAI 的审核结果。

## 第一次使用

启用插件后，在新对话输入：

> 请检查这个项目并提出改进计划，先不要修改文件。

必要时明确要求使用 adaptive-task-routing Skill。AI 应先交付计划，再附路由建议；这段请求没有授权实施。

## 你会看到什么

以下是不同情境的示例，接在计划或分析之后。保持设置的示例假设核对已获授权；只要求计划时则交付计划后结束。模型与原生推理设置仅作示意；“当前 AI”必须有实际观察依据。

**不值得切换时**

```text
---

### Adaptive Task Routing

✓ 保持当前设置

当前设置足够，而且剩余工作不多，切换带来的改善有限。

对话：留在当前对话，无需新建对话。
当前 AI：GPT-5.6 Sol / high。

无需操作，接着执行已授权的核对。
```

**值得切换时**

```text
---

### Adaptive Task Routing

调整 AI 设置

下一阶段的验证需求超过当前已观察设置的能力。

对话：留在当前对话，无需新建对话。
任务适配设置：GPT-6 Astra / high。

要改用 GPT-6 Astra / high 吗？
```

实际控制取决于平台。`auto` 只有验证成功才说已应用；无法操作时说明实际处理方式。当前信息不足时用“暂时沿用”，给出任务适配设置及简短原因，不声称已确认适合。关键阻碍才需要你决定。

只要求计划时，结尾说明计划已交付、尚未实施。需要交接时，显示“对话：建议新建对话并交接必要信息，等待你确认”，并提供必要事实与约束。

## 模式与详细程度

| 模式 | 行为 |
| --- | --- |
| `ask`（默认） | 变更前或有关键阻碍才询问；保留与不阻碍工作的 defer 继续已授权工作。 |
| `auto` | 只应用值得切换、已授权、受支持且可验证的变更；说明实际结果，不忽略重大阻碍。 |
| `off` | 跳过指定 Router 及其输出。 |

Context 与 Model 可分别设置，例如“这次关闭对话路由”“模型路由改用 ask”“这个对话的两个路由都用 auto”。模式变更本身不授权工作。

默认显示精简版。说“显示详细说明”可查看**最低足够设置、任务适配设置与升级理由**。适配设置回答本阶段适合什么；建议动作回答现在应该做什么。详细版复用原评估；切换评分只用于诊断，compact／detailed 不是额外模式。

确认保留时，精简版只显示已观察的当前 AI；其他适配设置留到详细说明。暂时沿用也可能来自切换成本或收益不明，不限于当前 AI 未知。

## 建议根据什么？

- **对话环境：** 评估下一个任务需要沿用哪些信息，以及旧任务的假设或限制是否可能干扰新工作，再建议保留对话、整理信息后交接，或从新对话开始。
- **模型和推理强度：** 考量任务难度、模糊程度、错误成本和验证需求，提供最低足够及任务适配设置，并说明提高设置是否值得。
- **模型信息来源：** 优先使用当前环境可取得的信息；无法取得时，根据平台使用套件内有效的参考资料。参考资料不代表你的账号一定能选用该模型。

完整判断原则与平台限制可查阅[设计与架构（英文）](../architecture.md)。

## 明确启用

- 支持 Skill 提及的 Codex 界面：`$adaptive-task-routing`
- Claude Code：`/adaptive-task-routing:adaptive-task-routing`
- 其他界面：输入“开始这项工作前，请使用 adaptive-task-routing Skill。”

## 移除

Gemini CLI：

```bash
gemini extensions uninstall adaptive-task-routing
```

Claude Code 如果通过 `--plugin-dir` 启动，结束该会话并删除克隆目录即可。ChatGPT 或 Codex 则从安装时使用的插件或 Marketplace 界面停用或移除。

## 故障排查

- 安装或更新后，请开启新对话。
- 确认 Skill 列表包含 `adaptive-task-routing`、`task-context-router` 和 `research-model-router`。
- 没有出现建议时，可先明确启用 Skill 测试一次。
- 显示建议不代表宿主已经切换模型或对话；只有经过验证的自动变更才会报告为已应用。

开发和验证细节请返回[开发说明（英文）](https://github.com/zyzdev/adaptive-task-routing/blob/main/DEVELOPMENT.md)。
