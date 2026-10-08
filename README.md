# Codex++ Public Plugin Cache

可公开再分发的 Codex 插件包快照。仓库包含实际插件文件和原生市场清单，支持从 GitHub 注册后安装。

**本仓库由社区维护，与 OpenAI 官方云端插件市场分别管理。**

当前快照：**520 个插件，约 508.53 MiB 插件文件**。各包保留原始许可；只收录有明确、已审核许可声明，且完整性和凭据检查通过的包。未声明许可不表示禁止再分发，但在取得充分依据前暂不公开缓存。

## 安装

```sh
codex plugin marketplace add BigPizzaV3/CodexPlusPlusPluginCache --ref main
codex plugin add google-drive@codex-plus-public-cache
```

可把 `google-drive` 换成清单内的插件名。注册市场仅建立目录，不会安装全部插件。安装后新开聊天以加载 Skills。

API Key 模式可以安装这里的插件包与 Skills。带 `.app.json` 的包可能依赖 ChatGPT 托管连接器；包安装成功不表示远程工具已连接。MCP 服务也可能需要独立凭据或运行环境。

市场授权策略设为 `ON_USE`。原生 Codex 安装流程仍可能为启用的 MCP 服务自动打开 OAuth 登录页；这个字段不能阻止原生 MCP 安装授权。建议按需安装。

## 下载与审核范围

已尝试读取云端完整目录的 **5513 个条目**，直接取得下载地址并读取包清单；这个过程不调用安装接口、不执行插件代码、不发起 OAuth 浏览器流程。

审核结果见 [docs/cloud-catalog-audit.json](docs/cloud-catalog-audit.json)。其中未声明许可、明确受限、不可下载或需要人工检查的条目分别统计，未把空目录或未审核的软件包当成已缓存插件。

首批 41 个包已用 Codex CLI 0.160.1、隔离的 API Key 登录验证，全部安装并启用，加载 366 个 Skills，加载错误为 0。初次安装测试触发了 12 个 OAuth 页面；未点击授权确认，页面已关闭。

后续从 GitHub 取得快照的 4 个样本安装成功。新增云端包通过文件完整性、许可声明、凭据标记和组件路径检查；为避免批量授权弹窗，不再逐个安装所有新包。

## 更新

```sh
codex plugin marketplace upgrade codex-plus-public-cache
codex plugin add google-drive@codex-plus-public-cache
```

这是版本快照。更新市场后按需重新安装目标插件。

## 来源与验证

- [NOTICE.md](NOTICE.md)：原始作者、许可和来源。
- [catalog.json](catalog.json)：版本、文件哈希、来源和排除条目。
- [LICENSES/](LICENSES/)：相关标准许可正文；各包自带的许可和版权文件继续保留。
- `python3 tools/validate_cache.py`：验证市场、文件哈希、许可集和组件引用。
- [docs/validation.json](docs/validation.json)：首批安装验证及已记录的副作用。
- [docs/git-validation.json](docs/git-validation.json)：GitHub 安装路径验证。

## 插件列表

| 插件 | 版本 | Skills | 许可 | 云端 App 引用 |
|---|---|---:|---|---|
| 12ui-design | 0.2.65 | 1 | MIT | 无 |
| 1password | 0.2.0 | 1 | MIT | 无 |
| 6x6 | 1.0.2 | 1 | MIT | 无 |
| actively | 1.0.0 | 0 | MIT | 有 |
| adaptive-task-routing | 0.5.0 | 3 | MIT | 无 |
| advisor | 1.4.6 | 1 | MIT | 无 |
| advisory | 0.2.1 | 8 | MIT | 无 |
| agent-parley | 0.14.0 | 0 | MIT | 无 |
| agent-reach | 1.5.0 | 1 | MIT | 无 |
| agent-skills | 0.6.10 | 25 | MIT | 无 |
| agentmarkup | 0.1.0 | 0 | MIT | 无 |
| agentproof | 0.1.0 | 1 | Apache-2.0 | 无 |
| ai-devkit | 0.62.1 | 28 | MIT | 无 |
| ai-graphic-design | 0.1.3 | 1 | MIT | 无 |
| ai-hooter | 0.3.9 | 1 | MIT | 无 |
| ai-review-skills | 0.3.2+codex.20260909134907 | 7 | MIT | 无 |
| ai-router | 1.0.0 | 7 | MIT | 无 |
| aiera | 1.0.0 | 0 | MIT | 有 |
| aivana-database-engineer | 1.1.0 | 59 | MIT | 无 |
| akinator | 2.0.0 | 0 | MIT | 无 |
| alation | 1.0.0 | 0 | MIT | 有 |
| amd-skills | 0.2.0 | 7 | MIT | 无 |
| analise-acoes-listadas | 1.0.0 | 1 | MIT | 无 |
| anarlog | 1.3.0 | 1 | MIT | 无 |
| andrej-karpathy-skills | 1.0.0 | 1 | MIT | 无 |
| anti-churn | 0.1.4 | 0 | MIT | 无 |
| antom-integration | 0.1.0 | 1 | MIT | 无 |
| antom-reconciliation-expert | 1.0.0 | 1 | MIT | 无 |
| app-69ca90f7924881918d4b8d06316e8f9c | 1.0.0 | 0 | MIT | 有 |
| app-6a16bcb9a37081919b0db1d81010fb2f | 1.0.0 | 1 | MIT | 有 |
| app-6a1a374657a88191bc1e22f3e9862dc6 | 2.0.0 | 1 | MIT | 有 |
| app-6a906843cab08191875b1054ea7b609a | 1.5.0 | 3 | MIT | 无 |
| app-design-research | 0.1.5 | 1 | MIT | 无 |
| apprentice | 0.1.0 | 4 | MIT | 无 |
| arabic-word-production | 0.1.1 | 1 | Apache-2.0 | 无 |
| arbitration | 0.2.1 | 10 | MIT | 无 |
| arkah | 0.1.1 | 1 | MIT | 有 |
| arrowgram | 0.1.0+codex.20260806033509 | 1 | MIT | 无 |
| asana | 7.0.0 | 0 | MIT | 有 |
| asoscan | 1.3.1 | 9 | MIT | 有 |
| astral-orchestrator | 3.12.1 | 1 | MIT | 无 |
| astria | 1.5.6 | 9 | MIT | 无 |
| atlas-scout | 1.0.0-preview.29 | 2 | Apache-2.0 | 无 |
| atlassian-rovo | 1.0.6 | 0 | MIT | 有 |
| atready | 0.1.14 | 1 | Apache-2.0 | 无 |
| attio | 1.0.0 | 0 | MIT | 有 |
| attri | 1.0.0 | 0 | MIT | 无 |
| auth0 | 2.1.1 | 1 | Apache-2.0 | 无 |
| auto-optimize-codex-agents-md | 1.0.2 | 1 | MIT | 无 |
| avoid-ai-writing | 3.29.0 | 7 | MIT | 无 |
| awesome-design-md | 1.0.0 | 1 | MIT | 无 |
| awesome-maintainer-defense | 1.1.1 | 1 | MIT | 无 |
| azure-cosmosdb | 1.2.0 | 1 | MIT | 无 |
| baton-pass-netheremp | 0.8.0 | 1 | MIT | 无 |
| bionemo-agent-toolkit | 0.1.0 | 33 | Apache-2.0 | 无 |
| blog-generator | 1.0.1 | 1 | Apache-2.0 | 无 |
| bloom | 1.0.0 | 1 | MIT | 有 |
| bodhikit | 1.23.0 | 18 | MIT | 无 |
| boltz-api-cli | 0.1.1 | 8 | MIT | 无 |
| brancha | 0.2.0 | 0 | MIT | 无 |
| brand24 | 2.0.0 | 0 | MIT | 有 |
| briefcase | 1.3.0 | 8 | MIT | 有 |
| brighthire | 1.0.0 | 1 | MIT | 有 |
| browser-act | 0.1.6 | 2 | MIT | 无 |
| browser-use | 0.13.10 | 6 | MIT | 无 |
| build-3d-game-rooms | 0.3.3 | 1 | MIT | 无 |
| build-ios-apps | 0.1.2 | 9 | MIT | 无 |
| build-macos-apps | 0.1.4 | 11 | MIT | 无 |
| build-steward | 0.1.1 | 0 | MIT | 无 |
| build-web-apps | 0.1.2 | 6 | MIT | 无 |
| build-web-data-visualization | 0.1.21 | 18 | MIT | 无 |
| building-react-native-apps | 0.2.0 | 5 | MIT | 无 |
| c4-investigator | 0.1.0 | 1 | MIT | 无 |
| california-property-tax-appeal-guide | 0.4.0+codex.20260913 | 1 | MIT | 无 |
| canonical-memory-verifier | 0.1.0 | 1 | Apache-2.0 | 无 |
| career-command-center | 1.3.0+codex.20260715213050 | 1 | MIT | 无 |
| career-command-centre | 4.0.0-beta.4 | 1 | Apache-2.0 | 无 |
| career-evidence-toolkit | 0.1.0 | 6 | Apache-2.0 | 无 |
| cargo-skills | 1.23.0 | 18 | MIT | 无 |
| cashback-card-finder | 2.0.1 | 2 | MIT | 无 |
| castreader | 0.1.4 | 3 | MIT | 无 |
| cecilialabs-ffmpeg | 2.0.0 | 10 | MIT | 无 |
| cerebrium | 0.1.0 | 0 | MIT | 无 |
| channel99 | 1.0.0 | 0 | MIT | 有 |
| chatcut | 1.0.4 | 1 | GPL-3.0-only | 有 |
| chatcut-desktop | 1.10.14 | 17 | GPL-3.0-only | 无 |
| chatgpt-codex-plugin-autopilot | 0.7.0 | 9 | MIT | 无 |
| chronograph | 2.0.0 | 3 | MIT | 有 |
| chronos | 0.9.2 | 2 | MIT | 无 |
| circleci | 1.0.4 | 4 | MIT | 无 |
| clickup | 1.0.3 | 0 | MIT | 有 |
| cloudflare | 0.1.2 | 9 | MIT | 无 |
| cloudinary | 1.0.0 | 0 | MIT | 有 |
| code | 1.0.0 | 1 | Apache-2.0 | 无 |
| code-ontology-companion | 0.6.0 | 1 | Apache-2.0 | 无 |
| coderabbit | 1.1.4 | 1 | MIT | 无 |
| codex-browser-recorder | 0.4.1 | 1 | MIT | 无 |
| codex-coordinator | 0.4.0 | 1 | MIT | 无 |
| codex-cost | 0.1.2 | 1 | MIT | 无 |
| codex-dev-workflows | 0.4.2 | 12 | MIT | 无 |
| codex-eli5 | 0.2.6 | 1 | Apache-2.0 | 无 |
| codex-engineering-guardrails | 1.1.1 | 2 | MIT | 无 |
| codex-process-jobs | 0.5.0 | 6 | Apache-2.0 | 无 |
| codex-sdlc | 1.0.0 | 8 | Apache-2.0 | 无 |
| codex-smart-router | 0.2.1 | 1 | MIT | 无 |
| codex-testflight-release | 0.1.1 | 1 | MIT | 无 |
| codex-usage-and-resets | 0.1.1 | 1 | Apache-2.0 | 无 |
| codex-voice-notify | 0.1.7 | 1 | MIT | 无 |
| comic-sol | 2.0.0 | 1 | MIT | 无 |
| completion-receipt | 0.1.5 | 0 | MIT | 无 |
| compound-engineering | 3.24.0 | 35 | MIT | 无 |
| compound-writing | 2.4.1 | 0 | MIT | 无 |
| conciliation | 0.2.1 | 4 | MIT | 无 |
| consultor | 0.1.2 | 18 | MIT | 无 |
| consumer | 0.2.1 | 5 | MIT | 无 |
| context-handoff | 0.3.4 | 1 | MIT | 无 |
| contracts | 0.2.4 | 10 | MIT | 无 |
| conversational-narrative | 0.1.0 | 5 | MIT | 无 |
| corporate | 0.2.1 | 8 | MIT | 无 |
| coupler-io | 1.0.0 | 0 | MIT | 有 |
| coupon-hive | 0.1.0+codex.20260915180819 | 1 | MIT | 无 |
| coursekin | 0.1.0 | 1 | MIT | 无 |
| coveo | 1.0.0 | 0 | MIT | 有 |
| creatify-ad-agent | 1.0.0 | 1 | MIT | 有 |
| creator-workbench | 0.3.3 | 29 | MIT | 无 |
| criminal | 0.2.1 | 6 | MIT | 无 |
| crowdstrike-falcon-foundry | 1.5.0 | 11 | MIT | 无 |
| crowdstrike-falcon-fusion | 1.2.0 | 7 | MIT | 无 |
| crypto-research-skills | 0.1.0 | 12 | MIT | 无 |
| cube | 1.0.0 | 0 | MIT | 有 |
| dataverse | 1.11.3 | 0 | MIT | 无 |
| deepnote | 2.0.0 | 5 | Apache-2.0 | 有 |
| defuddle | 0.19.4 | 1 | MIT | 无 |
| demand-from-the-file | 1.0.1 | 0 | MIT | 无 |
| design-arc | 1.5.5 | 1 | MIT | 无 |
| design-partner | 0.1.5 | 1 | MIT | 无 |
| designer | 1.0.0 | 1 | Apache-2.0 | 无 |
| devrecap | 0.3.0 | 1 | MIT | 无 |
| diagram-builder | 1.0.0 | 1 | Apache-2.0 | 无 |
| distilla | 1.0.2 | 0 | MIT | 无 |
| distributed-systems-skills-for-go | 0.4.0 | 6 | Apache-2.0 | 无 |
| docket | 1.0.0 | 0 | MIT | 有 |
| domotz-preview | 1.0.0 | 0 | MIT | 有 |
| dotenc | 0.1.3 | 1 | MIT | 无 |
| dovetail | 1.0.0 | 0 | MIT | 有 |
| dow-jones-factiva | 1.0.0 | 0 | MIT | 有 |
| dreamer | 1.2.0 | 2 | MIT | 无 |
| drum-notation-importer | 0.2.1 | 1 | MIT | 无 |
| dsir-gho | 0.1.1 | 1 | MIT | 无 |
| dsir-sdg | 0.1.0 | 1 | MIT | 无 |
| duende-skills | 0.3.0 | 24 | MIT | 无 |
| dyslex-ai | 0.3.7 | 16 | Apache-2.0 | 无 |
| eczid-agent-trust | 0.1.1 | 1 | MIT | 无 |
| eczid-api-trust | 0.1.1 | 1 | MIT | 无 |
| eczid-dora-readiness | 0.1.1 | 1 | MIT | 无 |
| eczid-mcp-trust | 0.1.1 | 1 | MIT | 无 |
| eczid-mcp-verifier | 0.1.1 | 1 | MIT | 无 |
| eczid-sbom-cra-readiness | 0.1.1 | 1 | MIT | 无 |
| eggshell | 0.1.0 | 1 | Apache-2.0 | 无 |
| egnyte | 3.0.0 | 0 | MIT | 有 |
| ego | 2.0.1 | 1 | MIT | 无 |
| email-love | 4.11.3 | 14 | MIT | 无 |
| employment | 0.2.1 | 7 | MIT | 无 |
| endor-labs-agent-kit | 2.2.2 | 12 | MIT | 无 |
| engineering-project-os | 2.2.1 | 1 | MIT | 无 |
| engineering-skills-for-go | 0.4.0 | 8 | Apache-2.0 | 无 |
| engineering-suite | 1.1.1 | 82 | MIT | 无 |
| engineering-suite-ask-matt | 2.0.0 | 39 | MIT | 无 |
| engineering-suite-brand-kit | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-build | 2.0.0 | 11 | MIT | 无 |
| engineering-suite-codebase-design | 2.0.0 | 4 | MIT | 无 |
| engineering-suite-debug | 2.0.0 | 9 | MIT | 无 |
| engineering-suite-design-system | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-grill-me | 2.0.0 | 8 | MIT | 无 |
| engineering-suite-handoff | 2.0.0 | 5 | MIT | 无 |
| engineering-suite-harden-ui | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-image-to-code | 2.0.0 | 5 | MIT | 无 |
| engineering-suite-mobile-mockup | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-motion-design | 2.0.0 | 5 | MIT | 无 |
| engineering-suite-plan | 2.0.0 | 5 | MIT | 无 |
| engineering-suite-polish | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-ponytail | 2.0.0 | 8 | MIT | 无 |
| engineering-suite-prototype | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-redesign | 2.0.0 | 6 | MIT | 无 |
| engineering-suite-research | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-review | 2.0.0 | 9 | MIT | 无 |
| engineering-suite-setup-matt | 2.0.0 | 3 | MIT | 无 |
| engineering-suite-shape-ui | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-ship | 2.0.0 | 11 | MIT | 无 |
| engineering-suite-stitch-design | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-taste | 2.0.0 | 8 | MIT | 无 |
| engineering-suite-teach | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-to-tickets | 2.0.0 | 5 | MIT | 无 |
| engineering-suite-triage | 2.0.0 | 6 | MIT | 无 |
| engineering-suite-ui-audit | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-ux-critique | 2.0.0 | 2 | MIT | 无 |
| engineering-suite-wayfinder | 2.0.0 | 8 | MIT | 无 |
| engineering-suite-web-mockup | 2.0.0 | 2 | MIT | 无 |
| esquisse-kun | 0.2.0-alpha.3 | 1 | MIT | 无 |
| essentio | 1.0.6 | 2 | MIT | 有 |
| evaldossier | 0.2.1 | 1 | MIT | 无 |
| expo | 1.0.2 | 13 | MIT | 无 |
| fallow | 1.2.23 | 2 | MIT | 无 |
| family | 0.2.3 | 5 | MIT | 无 |
| fashion-wardrobe | 1.1.2 | 2 | MIT | 无 |
| fast-io | 2.91.0 | 0 | MIT | 有 |
| fastapicloud | 0.3.2 | 6 | MIT | 无 |
| finance | 0.2.1 | 6 | MIT | 无 |
| finn | 1.0.0 | 0 | MIT | 有 |
| fintech-skills-for-go | 0.4.0 | 6 | Apache-2.0 | 无 |
| firebase | 1.1.0 | 0 | MIT | 无 |
| fireflies | 1.0.0 | 0 | MIT | 有 |
| fit-file-forge | 1.0.0 | 2 | MIT | 有 |
| fitness-ledger | 1.0.1 | 3 | MIT | 无 |
| flower | 0.3.3 | 2 | Apache-2.0 | 无 |
| flowstack-ui | 0.1.2 | 4 | MIT | 无 |
| football-charts | 1.0.0 | 1 | MIT | 有 |
| forgemind | 1.47.0+codex.20260828063918 | 18 | MIT | 无 |
| founder-pulse | 0.3.0 | 1 | MIT | 无 |
| freckle | 1.0.390 | 0 | MIT | 无 |
| freetts | 1.0.9 | 1 | MIT | 有 |
| frontend-design-premium | 1.4.0 | 2 | Apache-2.0 | 无 |
| frontier-infra | 0.3.2 | 0 | MIT | 无 |
| fstack | 1.1.2 | 75 | MIT | 无 |
| fullstack-dev-kit | 0.19.10 | 12 | Apache-2.0 | 无 |
| fyxer | 1.0.0 | 0 | MIT | 有 |
| gabriel-operator | 1.5.1 | 1 | MIT | 无 |
| game-development-studio | 1.0.2 | 5 | MIT | 无 |
| game-studio | 0.1.2 | 9 | MIT | 无 |
| generate-runbook | 0.4.0 | 0 | Apache-2.0 | 无 |
| geoai-skills | 0.4.0 | 18 | MIT | 无 |
| gh-review-loop | 0.4.2 | 1 | MIT | 无 |
| github | 0.1.12 | 0 | MIT | 有 |
| gmail | 0.1.10 | 0 | MIT | 有 |
| god-prompt | 1.0.24 | 1 | MIT | 无 |
| google-calendar | 1.2.7 | 0 | MIT | 有 |
| google-drive | 0.1.16 | 5 | MIT | 有 |
| gophers | 0.1.0 | 26 | MIT | 无 |
| gpt-workflows | 0.6.0 | 1 | MIT | 无 |
| granola | 1.0.0 | 0 | MIT | 有 |
| groundwork | 0.5.0 | 0 | MIT | 无 |
| gstack-workflows | 0.1.0 | 57 | MIT | 无 |
| happenstance | 1.0.0 | 0 | MIT | 有 |
| hebbia | 1.0.0 | 0 | MIT | 有 |
| hen-screenshots | 0.2.4 | 1 | MIT | 无 |
| heygrc | 0.1.1 | 1 | MIT | 无 |
| heytraders-codex | 1.0.1 | 1 | Apache-2.0 | 无 |
| hg-insights | 1.0.0 | 0 | MIT | 有 |
| hgraph-development | 0.1.0 | 3 | MIT | 无 |
| highlevel | 1.0.0 | 0 | MIT | 有 |
| hinge-profile-optimizer | 1.2.1 | 0 | MIT | 无 |
| hold-your-voice | 4.0.2 | 1 | MIT | 无 |
| hostinger-connector | 0.1.0 | 7 | MIT | 无 |
| hugging-face | 1.0.0 | 11 | MIT | 有 |
| humanizer | 3.0.0 | 1 | MIT | 无 |
| hyperframes | 0.1.2 | 5 | Apache-2.0 | 无 |
| i-have-headache | 1.1.0 | 0 | MIT | 无 |
| idea-generator | 1.0.2 | 1 | MIT | 无 |
| image-generator | 1.0.0 | 1 | Apache-2.0 | 无 |
| impeccable | 4.3.1 | 1 | Apache-2.0 | 无 |
| incident-io | 1.20261007.771 | 7 | MIT | 无 |
| insforge | 1.2.0 | 4 | Apache-2.0 | 无 |
| insolvency | 0.2.1 | 6 | MIT | 无 |
| intuitive-software-design | 1.3.1 | 0 | Apache-2.0 | 无 |
| investigations | 0.2.1 | 7 | MIT | 无 |
| ip | 0.2.1 | 6 | MIT | 无 |
| italian-investor | 0.5.1 | 0 | MIT | 无 |
| japanese-speaking-coach | 0.1.0 | 1 | MIT | 无 |
| jinko | 1.8.0 | 20 | MIT | 无 |
| json-change-lens | 1.0.1 | 1 | MIT | 无 |
| jucho-kun | 1.1.0 | 1 | MIT | 无 |
| kaeban | 0.1.17-preview.3 | 1 | MIT | 无 |
| kapa | 0.1.0 | 22 | MIT | 有 |
| kata | 1.0.0 | 0 | MIT | 无 |
| keelson | 0.6.7 | 1 | MIT | 无 |
| keystone | 2.0.4 | 9 | MIT | 无 |
| kling-ai-cli | 1.0.5 | 3 | MIT | 无 |
| la-review | 0.2.5 | 1 | MIT | 无 |
| legacy-jrxml-toolkit | 1.0.5 | 1 | MIT | 无 |
| legalquants-companion | 0.1.1 | 8 | Apache-2.0 | 无 |
| legalquants-transactional | 0.1.1 | 14 | Apache-2.0 | 无 |
| linchpin | 0.6.2 | 3 | MIT | 无 |
| linear | 5.0.1 | 0 | MIT | 有 |
| linkedin-animated-infographics | 3.7.0 | 9 | MIT | 无 |
| linkedin-text-styler | 1.0.1 | 1 | MIT | 无 |
| litigation | 0.3.0 | 16 | MIT | 无 |
| local-model-route-planner | 0.1.5 | 0 | MIT | 无 |
| logo-generator | 1.0.1 | 1 | Apache-2.0 | 无 |
| louisschprs | 0.1.0 | 1 | MIT | 无 |
| ls-doctor | 1.0.3 | 1 | MIT | 无 |
| luvus | 0.4.2 | 1 | Apache-2.0 | 无 |
| maeve-lite | 1.0.1 | 5 | Apache-2.0 | 无 |
| management-consulting | 2.2.0 | 0 | MIT | 无 |
| mandarin-talking-head-rough-cut | 1.1.0 | 1 | Apache-2.0 | 无 |
| marketing-swarm | 0.1.0 | 11 | MIT | 无 |
| mathbox | 3.2.0 | 0 | MIT | 无 |
| matt-skills-curated | 1.1.0 | 42 | MIT | 无 |
| mattpocock-skills | 1.2.3 | 35 | MIT | 无 |
| maxaeo-geo-toolkit | 0.2.0 | 2 | MIT | 无 |
| mediation | 0.2.1 | 6 | MIT | 无 |
| meme-marketing | 3.1.1 | 1 | MIT | 无 |
| memory-keeper | 0.5.0 | 8 | MIT | 无 |
| mergify | 1.0.0 | 6 | Apache-2.0 | 无 |
| mermaid-diagrams | 2.1.0 | 1 | Apache-2.0 | 无 |
| meshy-openai-plugin | 0.6.0 | 2 | MIT | 无 |
| metabase | 0.1.5 | 1 | MIT | 有 |
| microcms | 1.0.0 | 3 | MIT | 无 |
| mightshape | 1.0.1 | 1 | MIT | 无 |
| migrating-to-react-native | 0.1.1 | 2 | MIT | 无 |
| minimus | 1.0.4 | 2 | MIT | 无 |
| mixmatter | 3.0.0 | 4 | MIT | 无 |
| mixpanel | 2.0.0 | 0 | MIT | 有 |
| mixpanel-headless | 0.1.2 | 4 | MIT | 无 |
| mockflow | 0.3.1 | 2 | MIT | 无 |
| modal | 1.5.3 | 1 | Apache-2.0 | 无 |
| modelica-projects | 2.1.0 | 1 | Apache-2.0 | 无 |
| modern-web-guidance | 0.0.188 | 2 | Apache-2.0 | 无 |
| molviewer | 1.0.0 | 0 | MIT | 有 |
| moody-s | 3.0.0 | 2 | MIT | 有 |
| moos-ivp-skills | 1.4.12 | 10 | GPL-3.0-only | 无 |
| mt-newswires | 3.0.0 | 0 | MIT | 有 |
| muchita-shopping | 0.5.19 | 1 | MIT | 有 |
| musical | 0.1.0 | 1 | MIT | 无 |
| nacl | 0.2.2 | 76 | MIT | 无 |
| navigator | 0.1.2 | 1 | MIT | 无 |
| neon-postgres | 2.1.0 | 8 | Apache-2.0 | 无 |
| netlify | 1.6.0 | 15 | MIT | 有 |
| ngs-analysis | 1.0.3 | 18 | MIT | 无 |
| ngs-analysis-workbench | 0.2.18 | 5 | MIT | 无 |
| nightshift | 0.25.3 | 0 | MIT | 无 |
| nightvision | 0.2.0 | 4 | Apache-2.0 | 无 |
| no-ai-slop | 1.0.6 | 1 | MIT | 无 |
| noodle-seed | 0.33.58 | 0 | Apache-2.0 | 无 |
| notion | 0.1.7 | 4 | MIT | 有 |
| nvidia | 1.0.4 | 12 | Apache-2.0 AND CC-BY-4.0 | 无 |
| ogenic-god-toolkit | 1.2.4 | 8 | MIT | 无 |
| okrdev | 0.8.4 | 0 | MIT | 无 |
| onegate | 1.1.0 | 2 | MIT | 无 |
| onenote | 0.1.4 | 2 | MIT | 有 |
| open-design | 0.5.2 | 1 | Apache-2.0 | 无 |
| orbit-secretary | 0.2.0 | 1 | MIT | 无 |
| orchestrator-lite-cloud | 0.1.5 | 1 | MIT | 无 |
| outlook-calendar | 0.1.8 | 0 | MIT | 有 |
| outlook-email | 0.1.7 | 0 | MIT | 有 |
| outreach | 1.0.0 | 0 | MIT | 有 |
| oximy-reality-checks | 0.1.2 | 10 | MIT | 无 |
| paper-close-reading | 1.5.0 | 1 | MIT | 无 |
| particl-market-research | 2.0.0 | 0 | MIT | 有 |
| paytech | 1.10.0 | 0 | MIT | 无 |
| pdf-make | 1.0.0 | 1 | Apache-2.0 | 无 |
| pdf-parser | 1.3.2 | 1 | MIT | 无 |
| pet-platform-mode | 0.3.5 | 1 | MIT | 无 |
| pethost | 1.4.1 | 0 | MIT | 无 |
| pitchbook | 2.0.0 | 0 | MIT | 有 |
| pixeltable | 2.10.2 | 1 | Apache-2.0 | 无 |
| pixverse | 1.3.2 | 46 | MIT | 无 |
| plain-english | 0.6.1 | 0 | MIT | 无 |
| playdrop | 1.1.0 | 1 | MIT | 有 |
| plugin-eval | 0.1.2 | 5 | MIT | 无 |
| podpitch | 1.0.2 | 1 | MIT | 有 |
| poka-yoke | 0.2.0 | 11 | MIT | 无 |
| policynote | 1.0.0 | 0 | MIT | 有 |
| portable-mindmaps | 2.1.0 | 1 | Apache-2.0 | 无 |
| portable-resume | 0.4.5 | 17 | Apache-2.0 | 无 |
| posthog | 1.0.0 | 1 | MIT | 有 |
| powerbi-desktop | 3.0.0+codex.20260829143201 | 16 | MIT | 无 |
| pr-completion | 0.3.0 | 4 | MIT | 无 |
| practice | 0.2.1 | 5 | MIT | 无 |
| premiss | 0.2.1 | 1 | ISC | 有 |
| prepilot-for-marketing | 0.1.0 | 24 | MIT | 无 |
| presentation-generator | 1.0.0 | 1 | Apache-2.0 | 无 |
| presenton | 1.0.2 | 1 | Apache-2.0 | 无 |
| privacy | 0.2.2 | 6 | MIT | 无 |
| product-idea-pack | 0.1.2 | 1 | Apache-2.0 | 无 |
| product-support-investigator | 0.1.0 | 2 | MIT | 无 |
| progress-percent-plans | 1.0.2 | 1 | MIT | 无 |
| project-memory-core | 1.1.0 | 1 | MIT | 无 |
| prompt-optimizer | 0.1.9 | 0 | MIT | 无 |
| promptfoo | 0.1.3 | 0 | MIT | 无 |
| proofline | 2.0.2 | 1 | MIT | 无 |
| proofread | 0.4.0 | 1 | MIT | 无 |
| property | 0.2.1 | 7 | MIT | 无 |
| pstack-plugin | 0.2.0 | 26 | MIT | 无 |
| public | 0.2.1 | 6 | MIT | 无 |
| pylon | 1.0.0 | 0 | MIT | 有 |
| qamap | 0.5.1 | 1 | MIT | 无 |
| qlynk-agent-builder | 1.1.1 | 0 | MIT | 无 |
| qodo | 2.0.13 | 4 | MIT | 无 |
| quarryfi-time-tracker | 0.4.7 | 2 | MIT | 无 |
| questforge | 1.3.1 | 7 | MIT | 无 |
| quicknode | 1.0.0 | 0 | MIT | 有 |
| ragops | 2.0.2 | 1 | MIT | 无 |
| ranked-ai | 1.0.0 | 0 | MIT | 有 |
| razorpay | 1.0.0 | 0 | MIT | 有 |
| recurse | 0.2.4 | 1 | Apache-2.0 | 无 |
| reef-agent-improvement | 1.0.0 | 1 | Apache-2.0 | 无 |
| regulatory | 0.2.1 | 6 | MIT | 无 |
| remotion | 1.0.7 | 12 | MIT | 无 |
| research | 0.2.1 | 7 | MIT | 无 |
| revenue-kun | 0.5.2 | 1 | Apache-2.0 | 无 |
| revyl | 0.1.0 | 2 | MIT | 无 |
| rognalia-note-workspace | 0.1.2 | 9 | Apache-2.0 | 无 |
| rox | 1.0.0 | 0 | MIT | 有 |
| ru-text | 2.3.0 | 3 | MIT | 无 |
| runpod | 1.1.2 | 0 | Apache-2.0 | 无 |
| saymd | 0.1.2 | 1 | MIT | 无 |
| sentry | 0.1.2 | 1 | MIT | 无 |
| seomatic-seo-audit | 1.3.0 | 1 | MIT | 无 |
| seq2music | 0.3.2 | 1 | MIT | 无 |
| sequence-viewer | 0.1.43 | 1 | MIT | 无 |
| session-exporter | 0.1.2 | 1 | MIT | 无 |
| sharepoint | 0.1.7 | 0 | MIT | 有 |
| ship24 | 1.0.0 | 7 | MIT | 无 |
| shipframe | 0.4.2 | 22 | MIT | 无 |
| shiro | 1.0.1 | 1 | Apache-2.0 | 无 |
| shopify-app-builder | 1.4.1 | 32 | MIT | 无 |
| short-circuit-codex | 0.2.0 | 1 | Apache-2.0 | 无 |
| shutterstock | 2.0.0 | 0 | MIT | 有 |
| similarweb | 2.0.0 | 0 | MIT | 有 |
| simugen | 1.0.0 | 1 | MIT | 无 |
| simulator-login | 1.0.1 | 1 | MIT | 无 |
| skarn | 0.27.0 | 1 | MIT | 无 |
| skill-craft | 1.3.0 | 3 | MIT | 无 |
| skill-risk-check | 0.1.5 | 0 | MIT | 无 |
| skillquiver | 2.1.0 | 23 | MIT | 无 |
| skywatch | 1.0.0 | 0 | MIT | 有 |
| slack | 0.1.7 | 0 | MIT | 有 |
| slide-viewer | 0.1.67 | 1 | MIT | 无 |
| socialclaw | 1.0.2 | 1 | MIT | 有 |
| soku | 0.1.0-alpha.18 | 1 | MIT | 无 |
| speaker-delivery-profiler | 1.0.1 | 1 | MIT | 无 |
| ssot-check | 0.1.4 | 1 | MIT | 无 |
| stacktree | 1.1.0 | 5 | MIT | 有 |
| startup | 0.2.1 | 7 | MIT | 无 |
| statsig | 3.0.0 | 0 | MIT | 有 |
| streampay | 1.0.1 | 1 | MIT | 有 |
| structure-viewer | 0.1.92 | 1 | MIT | 无 |
| supabase | 1.0.0 | 2 | MIT | 有 |
| superdesign | 0.6.0 | 1 | MIT | 无 |
| superpowers | 6.3.0 | 14 | MIT | 无 |
| surfer | 0.1.0 | 7 | MIT | 有 |
| swift-concurrency | 2.3.0 | 1 | MIT | 无 |
| swiftui-expert | 5.2.0 | 1 | MIT | 无 |
| tahr-codex-plugin | 0.3.3 | 12 | GPL-3.0-only | 无 |
| tailscale | 1.0.0-alpha-1 | 1 | BSD-3-Clause | 无 |
| talamus-memory | 1.1.1 | 1 | Apache-2.0 | 无 |
| task-eta-tracker | 0.1.0 | 1 | MIT | 无 |
| taskplane | 2.31.5 | 10 | Apache-2.0 | 无 |
| taskplanner | 2.1.1 | 6 | MIT | 无 |
| tax | 0.2.1 | 7 | MIT | 无 |
| teams | 0.1.8 | 0 | MIT | 有 |
| telecall | 1.0.0 | 1 | MIT | 无 |
| temporal | 0.4.0 | 4 | MIT | 无 |
| test-android-apps | 0.1.2 | 2 | MIT | 无 |
| testing-react-native-apps | 0.1.0 | 3 | MIT | 无 |
| text-to-cad | 0.7.10 | 13 | MIT | 无 |
| the-autonomous-cio | 0.1.1 | 133 | MIT | 无 |
| the-fifth-ledger | 0.1.0 | 8 | Apache-2.0 | 无 |
| the-living-bread | 1.0.9 | 1 | MIT | 有 |
| thoughtfulbits-skills | 1.4.0 | 6 | MIT | 无 |
| thoughtspot | 3.0.0 | 0 | MIT | 有 |
| tidyguardian | 2.0.1 | 1 | MIT | 无 |
| tight-studio | 0.2.0 | 1 | MIT | 无 |
| tinman-ai | 1.0.3 | 0 | MIT | 有 |
| tochi-satei-kun | 1.5.0 | 1 | Apache-2.0 | 无 |
| tree-ring-memory | 0.3.10 | 1 | MIT | 无 |
| treg | 0.11.0 | 1 | Apache-2.0 | 无 |
| trellis | 0.6.1 | 2 | CC0-1.0 | 无 |
| trigger-tree | 1.30.2 | 1 | MIT | 无 |
| trinity-capture | 0.3.4 | 1 | Apache-2.0 | 无 |
| tripo-3d | 0.2.3 | 2 | MIT | 无 |
| trylle | 0.1.6 | 1 | MIT | 无 |
| twg | 1.0.5 | 1 | Apache-2.0 | 无 |
| twilio-developer-kit | 0.2.2 | 55 | MIT | 无 |
| uniformdev | 1.0.0 | 11 | MIT | 无 |
| unity-workbench | 0.1.3 | 6 | MIT | 无 |
| unreal-engine-skills-for-codex | 0.1.7 | 2 | MIT | 无 |
| usage-checker | 0.3.2 | 1 | MIT | 无 |
| vapi-voice-ai | 1.2.1 | 11 | MIT | 无 |
| vercel | 0.21.4 | 54 | Apache-2.0 | 有 |
| verify | 0.2.1 | 4 | MIT | 无 |
| vibe-coding | 1.3.0 | 46 | MIT | 无 |
| vibooks | 0.4.0 | 5 | Apache-2.0 | 无 |
| video-lab | 1.2.1 | 0 | MIT | 无 |
| villagesql | 1.0.0 | 1 | Apache-2.0 | 无 |
| visual-truth | 1.3.0 | 1 | MIT | 无 |
| voiceover-lab | 3.6.0 | 37 | MIT | 无 |
| waggle-installer | 1.0.0 | 1 | Apache-2.0 | 无 |
| weatherpromise | 1.0.0 | 0 | MIT | 有 |
| webcmd | 0.8.4 | 1 | Apache-2.0 | 无 |
| webmcp | 1.0.0 | 1 | MIT | 无 |
| webmcp-kit | 0.4.0 | 2 | MIT | 无 |
| websitebuilder | 2.2.0 | 0 | MIT | 无 |
| willy-seo | 1.0.0 | 1 | MIT | 无 |
| world-flag-map | 0.1.2 | 1 | MIT | 无 |
| worldkeep | 0.3.3 | 0 | MIT | 无 |
| write-like-me | 1.0.0-rc.7+codex.20260831154635 | 1 | MIT | 无 |
| writer | 1.0.0 | 1 | Apache-2.0 | 无 |
| xweather | 0.14.1 | 0 | MIT | 无 |
| yaps-audio-cleaner | 0.1.10 | 1 | MIT | 无 |
| yaps-auto-captions | 0.1.11 | 1 | MIT | 无 |
| yaps-background-removal | 0.1.11 | 1 | MIT | 无 |
| yaps-dictation | 0.1.11 | 1 | MIT | 无 |
| yaps-meeting-transcription | 0.1.10 | 1 | MIT | 无 |
| yaps-memory | 0.2.14 | 1 | MIT | 无 |
| yaps-srt-generator | 0.1.11 | 1 | MIT | 无 |
| yaps-text-to-speech | 0.1.11 | 1 | MIT | 无 |
| yaps-transcription | 0.1.11 | 1 | MIT | 无 |
| yaps-translation | 0.1.12 | 1 | MIT | 无 |
| yaps-video-clipping | 0.1.5 | 0 | MIT | 无 |
| yaps-video-to-audio | 0.1.10 | 1 | MIT | 无 |
| ycloud-developer-kit | 0.7.9 | 17 | Apache-2.0 | 无 |
| yepcode | 1.0.0 | 0 | MIT | 有 |
| you | 0.2.0 | 5 | MIT | 无 |
| zilliz | 1.4.4 | 20 | Apache-2.0 | 无 |
| zoho | 2.0.0 | 0 | MIT | 有 |
| zoom | 1.0.0 | 27 | MIT | 有 |
| zotero | 0.1.2 | 1 | MIT | 无 |
| zuora-coding-agent | 1.5.4 | 40 | MIT | 无 |
| zzzops | 2.1.0 | 9 | Apache-2.0 | 无 |

新增快照只读验证见 [docs/expanded-read-validation.json](docs/expanded-read-validation.json)：API Key 环境已识别全部市场条目，并逐项读取插件详情；未调用安装接口或执行 MCP。

