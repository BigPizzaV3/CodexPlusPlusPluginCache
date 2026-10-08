# Codex++ Public Plugin Cache

可公开再分发的 Codex 插件包快照。仓库包含实际插件文件和原生市场清单，支持从 GitHub 注册后安装。

**本仓库由社区维护，与 OpenAI 官方云端插件市场分别管理。**

当前快照：**41 个插件，约 22.6 MiB 插件文件**。仅收录声明 MIT、Apache-2.0、GPL-3.0-only 或 Apache-2.0 AND CC-BY-4.0，且没有发现相冲突许可的现有包。Proprietary、UNLICENSED、未声明许可、需要另查的 LicenseRef 和未获取的外部包均未收录。

## 安装

```sh
codex plugin marketplace add BigPizzaV3/CodexPlusPlusPluginCache --ref main
codex plugin add google-drive@codex-plus-public-cache
```

可把 `google-drive` 换成清单内的插件名。注册市场仅建立目录，不会安装全部插件。安装后新开聊天以加载 Skills。

API Key 模式可以安装这里的插件包与 Skills。带 `.app.json` 的插件仍可能依赖 ChatGPT 托管连接器；包安装成功不表示远程工具已连接。MCP 服务也可能需要独立凭据或运行环境。

市场条目的授权策略统一设为 `ON_USE`（首次使用时授权）。原生 Codex 安装流程仍可能为启用的 MCP 服务自动打开 OAuth 登录页；这个字段不能保证阻止此行为。仅注册市场不会安装或启用全部插件，建议按需安装。原始插件包文件保持不变。

已用 Codex CLI 0.160.1、隔离的 API Key 登录验证：41 个插件全部安装并启用，加载 366 个 Skills，加载错误为 0。未使用 ChatGPT 凭据；未执行云端连接器和 MCP 工具。初次测试触发了 12 个 OAuth 页面；未点击授权确认，测试页已关闭。源码确认安装会启动启用的 MCP 服务的 OAuth 流程，与市场授权策略分别处理。

## 更新

```sh
codex plugin marketplace upgrade codex-plus-public-cache
codex plugin add google-drive@codex-plus-public-cache
```

这是版本快照；升级市场后，按需重新安装目标插件。

## 来源与验证

- [NOTICE.md](NOTICE.md)：各包原始作者、许可和来源说明。
- [catalog.json](catalog.json)：版本、文件哈希、来源和排除条目。
- [LICENSES/](LICENSES/)：标准许可正文；各包原有的许可文件继续保留。
- `python3 tools/validate_cache.py`：检查市场、原始文件哈希、许可集和引用路径。
- [docs/validation.json](docs/validation.json)：隔离环境下的 API Key 安装验证结果。
- [docs/git-validation.json](docs/git-validation.json)：从已发布 GitHub 仓库取得快照并安装四个样本的验证结果。

## 插件列表

| 插件 | 版本 | Skills | 许可 | 云端 App 引用 |
|---|---|---:|---|---|
| atlassian-rovo | 1.0.6 | 0 | MIT | 有 |
| boltz-api-cli | 0.1.1 | 8 | MIT | 无 |
| build-ios-apps | 0.1.2 | 9 | MIT | 无 |
| build-macos-apps | 0.1.4 | 11 | MIT | 无 |
| build-web-apps | 0.1.2 | 6 | MIT | 无 |
| build-web-data-visualization | 0.1.21 | 18 | MIT | 无 |
| chatcut | 1.0.4 | 1 | GPL-3.0-only | 有 |
| circleci | 1.0.4 | 4 | MIT | 无 |
| clickup | 1.0.3 | 0 | MIT | 有 |
| cloudflare | 0.1.2 | 9 | MIT | 无 |
| coderabbit | 1.1.4 | 1 | MIT | 无 |
| expo | 1.0.2 | 13 | MIT | 无 |
| game-studio | 0.1.2 | 9 | MIT | 无 |
| github | 0.1.12 | 0 | MIT | 有 |
| gmail | 0.1.10 | 0 | MIT | 有 |
| google-calendar | 1.2.7 | 0 | MIT | 有 |
| google-drive | 0.1.16 | 5 | MIT | 有 |
| granola | 1.0.0 | 0 | MIT | 有 |
| hyperframes | 0.1.2 | 5 | Apache-2.0 | 无 |
| linear | 5.0.1 | 0 | MIT | 有 |
| mixpanel-headless | 0.1.2 | 4 | MIT | 无 |
| ngs-analysis | 1.0.3 | 18 | MIT | 无 |
| notion | 0.1.7 | 4 | MIT | 有 |
| nvidia | 1.0.4 | 12 | Apache-2.0 AND CC-BY-4.0 | 无 |
| outlook-calendar | 0.1.8 | 0 | MIT | 有 |
| outlook-email | 0.1.7 | 0 | MIT | 有 |
| plugin-eval | 0.1.2 | 5 | MIT | 无 |
| posthog | 1.0.0 | 1 | MIT | 有 |
| remotion | 1.0.7 | 12 | MIT | 无 |
| sentry | 0.1.2 | 1 | MIT | 无 |
| sharepoint | 0.1.7 | 0 | MIT | 有 |
| slack | 0.1.7 | 0 | MIT | 有 |
| supabase | 1.0.0 | 2 | MIT | 有 |
| superpowers | 6.3.0 | 14 | MIT | 无 |
| teams | 0.1.8 | 0 | MIT | 有 |
| temporal | 0.4.0 | 4 | MIT | 无 |
| test-android-apps | 0.1.2 | 2 | MIT | 无 |
| twilio-developer-kit | 0.2.2 | 55 | MIT | 无 |
| vercel | 0.21.4 | 54 | Apache-2.0 | 有 |
| zoom | 1.0.0 | 27 | MIT | 有 |
| zotero | 0.1.2 | 1 | MIT | 无 |
