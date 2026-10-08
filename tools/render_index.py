# -*- coding: utf-8 -*-
"""从来源清单生成仓库首页和作者声明，不修改插件内容。"""
from pathlib import Path
import collections
import json

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'catalog.json').read_text())
plugins = catalog['plugins']
byte_count = sum(v['bytes'] for v in plugins)
licenses = dict(collections.Counter(v['declaredLicense'] for v in plugins))
audit_path = ROOT / 'docs/cloud-catalog-audit.json'
audit = json.loads(audit_path.read_text()) if audit_path.exists() else None

lines = ['# Codex++ Public Plugin Cache', '', '可公开再分发的 Codex 插件包快照。仓库包含实际插件文件和原生市场清单，支持从 GitHub 注册后安装。', '', '**本仓库由社区维护，与 OpenAI 官方云端插件市场分别管理。**', '', f'当前快照：**{len(plugins)} 个插件，约 {byte_count / 1024**2:.2f} MiB 插件文件**。各包保留原始许可；只收录有明确、已审核许可声明，且完整性和凭据检查通过的包。未声明许可不表示禁止再分发，但在取得充分依据前暂不公开缓存。', '', '## 安装', '', '```sh', 'codex plugin marketplace add BigPizzaV3/CodexPlusPlusPluginCache --ref main', 'codex plugin add google-drive@codex-plus-public-cache', '```', '', '可把 `google-drive` 换成清单内的插件名。注册市场仅建立目录，不会安装全部插件。安装后新开聊天以加载 Skills。', '', 'API Key 模式可以安装这里的插件包与 Skills。带 `.app.json` 的包可能依赖 ChatGPT 托管连接器；包安装成功不表示远程工具已连接。MCP 服务也可能需要独立凭据或运行环境。', '', '市场授权策略设为 `ON_USE`。原生 Codex 安装流程仍可能为启用的 MCP 服务自动打开 OAuth 登录页；这个字段不能阻止原生 MCP 安装授权。建议按需安装。', '', '## 下载与审核范围', '']
if audit:
    lines += [f"已尝试读取云端完整目录的 **{audit['directoryEntriesReviewed']} 个条目**，直接取得下载地址并读取包清单；这个过程不调用安装接口、不执行插件代码、不发起 OAuth 浏览器流程。", '', '审核结果见 [docs/cloud-catalog-audit.json](docs/cloud-catalog-audit.json)。其中未声明许可、明确受限、不可下载或需要人工检查的条目分别统计，未把空目录或未审核的软件包当成已缓存插件。', '']
lines += ['首批 41 个包已用 Codex CLI 0.160.1、隔离的 API Key 登录验证，全部安装并启用，加载 366 个 Skills，加载错误为 0。初次安装测试触发了 12 个 OAuth 页面；未点击授权确认，页面已关闭。', '', '后续从 GitHub 取得快照的 4 个样本安装成功。新增云端包通过文件完整性、许可声明、凭据标记和组件路径检查；为避免批量授权弹窗，不再逐个安装所有新包。', '', '## 更新', '', '```sh', 'codex plugin marketplace upgrade codex-plus-public-cache', 'codex plugin add google-drive@codex-plus-public-cache', '```', '', '这是版本快照。更新市场后按需重新安装目标插件。', '', '## 来源与验证', '', '- [NOTICE.md](NOTICE.md)：原始作者、许可和来源。', '- [catalog.json](catalog.json)：版本、文件哈希、来源和排除条目。', '- [LICENSES/](LICENSES/)：相关标准许可正文；各包自带的许可和版权文件继续保留。', '- `python3 tools/validate_cache.py`：验证市场、文件哈希、许可集和组件引用。', '- [docs/validation.json](docs/validation.json)：首批安装验证及已记录的副作用。', '- [docs/git-validation.json](docs/git-validation.json)：GitHub 安装路径验证。', '', '## 插件列表', '', '| 插件 | 版本 | Skills | 许可 | 云端 App 引用 |', '|---|---|---:|---|---|']
for v in plugins:
    lines.append(f"| {v['name']} | {v['version']} | {v['skillCount']} | {v['declaredLicense']} | {'有' if v['hasAppConnectorReferences'] else '无'} |")
lines += ['', '## 大仓库的注册方式', '', '完整快照较大；Codex CLI 0.160.1 的市场刷新 Git clone 有 30 秒超时，较慢网络可能无法直接完成。可先用普通 Git 克隆，再注册本地 Git 工作目录：', '', '```sh', 'git clone --depth 1 https://github.com/BigPizzaV3/CodexPlusPlusPluginCache.git', 'cd CodexPlusPlusPluginCache', 'codex plugin marketplace add "$PWD"', '```', '', '这种方式仍从 GitHub 获取插件文件，更新时在该目录运行 `git pull --ff-only`。', '', '新增快照只读验证见 [docs/expanded-read-validation.json](docs/expanded-read-validation.json)：API Key 环境已识别全部市场条目，并逐项读取插件详情；未调用安装接口或执行 MCP。', '']
(ROOT / 'README.md').write_text('\n'.join(lines) + '\n')

notices = ['# 来源与许可', '', '各插件内容按原始许可再分发。本仓库没有为所有插件统一改换许可。原始作者字段、版权声明和已附带的 LICENSE / NOTICE 文件保留。少数文件按上游 Git 属性统一换行符；未改动代码语义。', '', 'catalog.json 记录每个文件的 SHA-256 和获取来源；originalFileSha256 记录换行符规范化前的哈希。LICENSES/ 提供相关标准许可正文；它们不替代各包已有的版权和第三方声明。', '', '| 插件 | 版本 | 原始作者 | 声明的许可 | 来源类型 |', '|---|---|---|---|---|']
for v in plugins:
    a = v.get('author') or {}
    author = a.get('name', 'See original plugin manifest') if isinstance(a, dict) else str(a)
    notices.append(f"| {v['name']} | {v['version']} | {author.replace('|', '/')} | {v['declaredLicense']} | {v['sourceKind']} |")
notices += ['', '## 获取来源', '', '公开源码包来自 https://github.com/openai/plugins，revision 保存在各包的 upstreamGitRevision 字段。部分更新版本来自已安装云端包；后续包直接从 ChatGPT Global 插件服务下载，原始包 ID、版本和归档哈希保存在 catalog.json。', '', '仓库增加市场、来源说明、标准许可正文与验证工具。换行符规范化的文件和包在 catalog.json 中明确记录。带 CC-BY-4.0 的内容保留原作者署名并提供许可链接；GPL 包保留其原始源文件和许可。', '', '标准许可原文：', '', '- MIT：https://opensource.org/license/mit', '- Apache-2.0：https://www.apache.org/licenses/LICENSE-2.0', '- GPL-3.0：https://www.gnu.org/licenses/gpl-3.0.html', '- CC-BY-4.0：https://creativecommons.org/licenses/by/4.0/legalcode', '', '品牌、商标及远程服务权限不因包再分发而改变。作者信息用于注明来源，不表示作者为本缓存仓库背书。', '']
(ROOT / 'NOTICE.md').write_text('\n'.join(notices))
print(json.dumps({'packages': len(plugins), 'bytes': byte_count, 'licenses': licenses}, ensure_ascii=False))
