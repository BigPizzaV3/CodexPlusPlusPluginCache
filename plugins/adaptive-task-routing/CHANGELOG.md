# Changelog

All notable changes to this project are documented here.

## [0.5.0] - 2026-09-13

### Changed

- Require complete analysis/plan-only deliverables before the divider and one final routing
  note; action-first applies inside the note. Keep proposed implementation conditional.
- Require observed current AI, phase-specific quality evidence and retention evidence for
  verified model keep. Gemini default reasoning is not a substitute for current model identity.
- Standardize Traditional Chinese action lines across hosts, with a separate short reason.
- Add offline regressions for the reported Gemini ordering/default-label defects and retain
  explicit semantic-review requirements; passing output checks do not prove model adherence.
- Simplify the heading to `Adaptive Task Routing` and merge context advice into one
  conversation sentence across all platforms and translated examples.
- Show only the observed current AI for verified keep in compact output; reserve task-fit
  alternatives for details. Provisional keep still covers uncertain switching costs or benefits.
- Ask only whether to use the named target for an ordinary setting change. Broader questions
  require a material blocker; extra validation after declining must be feasible and sufficient.
- Lead routing notes with the action and reason. Default compact output preserves enabled
  conversation advice and useful AI settings; detailed adds minimum needed, task-fit
  settings and upgrade rationale without exposing internal switching scores.
- Change `ask` to confirm proposed environment changes or material blockers. Retain and
  nonblocking defer continue only already authorized work; plan-only requests never authorize
  implementation. Provisional retention does not certify unknown settings as suitable.
- Share one UX contract across both Skills and Gemini runtime entrypoints, preserve independent
  context/model modes and combined handoff/model decisions, and refresh multilingual examples.
- Add offline contract/package regressions and U01–U14 acceptance specifications. Earlier live
  routing reports remain historical; no new model calls or savings benchmarks were run for this UX update.
- Keep Gemini's explicit conversation advice in the main
  output sequence and a single complete routing example, including when model switching is deferred.
- Live CLI testing exposed manual-switch prompts after a deferred switch decision.
  Select retention versus manual-control paragraphs explicitly in the model router,
  OpenAI guide and Gemini projection; cover the conflicting-template regression.
- Evaluate model and reasoning changes at task boundaries using remaining-phase benefit,
  switching cost and context continuity; retain suitable settings rather than automatically
  downgrading after demanding work.
- Separate task-based upgrade value from switch value against the observed current setup.
  Unknown baselines defer automatic changes; cache uncertainty is not treated as zero cost,
  and quality deficits can outweigh continuity benefits.
- Carry effective context and handoff costs into model routing, including declined handoffs
  and context-off/model-only paths. Apply the same contract to both Gemini projections.
- Require a justified switch before router-initiated automatic application, preserve explicit
  user setting requests, and show a concise switch assessment with a consistent action.
- Update multilingual product guidance and add switch acceptance cases and release checks.

## [0.4.2] - 2026-09-12

### Changed

- Separate task output from routing advice with a Markdown divider, a localized `Adaptive Task Routing` task-resource heading, and a one-sentence explanation that the settings apply to the planned next phase.
- Make Gemini automatic routing self-contained in the extension startup context. Gemini CLI 0.59.0 can advertise `activate_skill` while returning `tool_not_registered` at execution, so `GEMINI.md` now embeds and applies the complete compact coordinator contract without depending on that failing call; explicit Skills remain packaged.
- Keep automatic activation on the host-native prompt boundary, but complete and present requested analysis or planning before routing the resulting substantial next phase. For execution requests, present an actionable plan before the gate. Default `ask` stops after its recommendation and waits for a natural user response; only `auto` may continue automatically.
- Make multi-step analysis, inspection, audits, scans, research and planning explicitly eligible. A cross-file release-flow, cross-platform consistency or test-gap scan cannot be dismissed as informational when its findings identify actionable changes or validation work.
- Make `adaptive-task-routing` the primary description match for general substantial tasks. When a host selects a context-only or model-only child for such a task, dispatch once to the coordinator and use delegation markers to prevent recursion, preserving explicit component-only invocations.
- Require a concrete supported model/effort recommendation when applicable catalog and capability evidence are sufficient, even if current settings are unknown. Keep comparison and application separate.
- Continue scoped discovery after excluding a subagent-only menu; unverified retention must report the actual discovery outcome or access limitation. Update English/Traditional Chinese guidance and regression fixtures.
- Resolve the probe's initial applicability label in the caller: an established same-environment CLI catalog supports recommendations independently of unknown live settings or other failed metadata reads. Keep App/CLI scope checks specific to their destination.
- Add an explicit helper `--surface` scope. A fresh catalog requested from an identified Codex CLI task is candidate-availability evidence by default; only observed availability-changing launch mismatches invalidate it. Separate-process execution and unknown live settings no longer justify `CURRENT / CURRENT`.
- Add bounded `--surface auto` detection using positive process or exact-thread origin evidence, and make the coordinator preserve the identified surface so an unnamed Codex CLI prompt is not treated as Codex App. Clarify plugin-root resolution for shared policy files.
- Classify project-sandbox App Server startup failures without exposing stderr. Use the current execution's available capability: a successful read supplies current/catalog evidence, while a permission-limited read falls back immediately to the bundled registry without an extra permission interruption.
- Refresh a complete six-model Codex CLI registry with runtime descriptions, official task-selection guidance, display names, defaults and all supported efforts, including Luna `ultra`.
- Require separate minimum-sufficient and recommended model/effort settings, plus low/medium/high upgrade value and a task-specific explanation. Unknown current settings no longer collapse a useful decision to `CURRENT / CURRENT`.
- Separate catalog reads from switch controls. In `auto`, apply a recommendation only through callable, authorized and verifiable model/effort operations; otherwise show the surface-appropriate control as an option, retain the current setting and continue authorized work without requiring a confirmation word. Omit unreadable current fields and discovery diagnostics from compact output.
- Add a dedicated localized conversation block with a plain-language recommendation and an explicit yes/no window-switch answer before the two AI-setting blocks. Keep raw context enums in structured evidence only.
- Use the visible model/reasoning selector in ChatGPT App and web instructions without mentioning the CLI-only `/model` command; identified Codex CLI instructions continue to use `/model` directly.
- Treat the bundled, officially described OpenAI model inventory as cross-surface recommendation evidence when App runtime metadata is unavailable. Produce both concrete settings without requesting a copied selector; keep account availability unverified internally.
- Defer permission escalation until a user questions a recommendation. Explain the evidence first, then ask once only when a narrowly scoped permission can unlock the same App/session model list; otherwise continue with the fallback without repeated prompts.
- Add a Gemini CLI fallback registry using the current stable aliases and require model-native reasoning output, preventing legacy Gemini 1.5 names and unsupported Codex-style effort levels.
- Add regression coverage for registry completeness, capability metadata, sandbox failure classification and permission-denial fallback behavior.

## [0.4.1] - 2026-09-12

### Changed

- Added host-native automatic activation reminders: a Codex `UserPromptSubmit` plugin hook, a Claude Code `UserPromptSubmit` plugin hook, and an extension `GEMINI.md` loaded through `contextFileName`.
- Kept routing judgment inside the coordinator Skill. The startup integrations inject only a short eligibility reminder and skip ordinary chat, status checks, tiny operations, plugin-only questions, and unchanged phases.
- Added package validation and regression coverage for all three automatic activation integrations. Codex may require one-time hook trust; Gemini loads the reminder after a CLI restart.

## [0.4.0] - 2026-09-12

### Evidence-based routing / 有依據的路由

- Preserve all three Skill names, frontmatter and triggers; extend bodies and translations with task requirements independent of model availability.
- Separate live configuration, persisted thread settings, disk defaults, scoped catalogs and capability descriptions. Unknown settings no longer suppress useful task guidance.
- Add on-demand Codex/ChatGPT, Claude Code and Gemini CLI discovery references. Include an optional Python 3.10+ Codex read-only metadata helper, with bounded RPCs, no model calls and no setting writes; it does not run on installation or Skill loading.
- Add capability-discovery regression fixtures and a seven-surface acceptance matrix. Official descriptions guide candidates, not account availability or unmeasured performance rankings.
- Rebuild all three platform packages from the same canonical sources. No automatic model switch, hook, service, public publication or persistent installation is introduced.

## [0.3.2] - 2026-09-11

### Release preparation / 發布前重整

- Consolidated three identical Skill/shared-policy trees into a single maintained source; preserved all Skill bodies and trigger descriptions. 合併單一來源並保留原觸發與內容。
- Added deterministic three-platform builds, portable OpenAI manifest plus Codex compatibility, strict source/archive/checksum validation and regression tests.
- Added a 24-case cross-platform evaluation matrix, including five positive and three negative OpenAI submission cases; live behavioral runs remain explicitly unexecuted until evidence is recorded.
- Corrected platform installation, architecture and owner-controlled public submission instructions. No repository, release or platform submission was published.

## [0.3.1] - 2026-09-07

### Added / 新增

- Thin `adaptive-task-routing` coordinator that reads the independent routers in order, with Traditional Chinese guidance. 新增薄型協調入口，依序讀取兩個獨立 Router，並提供繁體中文說明。
- Plan-delivery, unknown-configuration, disabled-mode, deferred-destination, and duplicate-gate evaluation cases. 新增交付計畫、未知設定、關閉模式、目的地待定及重複 Gate 案例。
- Full archive payload, relative dependency, manifest, and checksum validation. 完整驗證封裝內容、相對依賴、Manifest 與校驗碼。
- First-use capability snapshots plus session/short-lived dynamic model-catalog caching. 新增首次能力快照及 Session／短期動態模型清單快取。

### Changed / 調整

- Extended model routing to implementation, debugging, architecture, validation, and substantial next phases proposed by improvement plans. 擴大 Model Router 至開發、除錯、架構、驗證與改善計畫的實質下一階段。
- Required visible model/effort results for enabled invocations, including `CURRENT`, unknown and deferred state; `off` remains silent. 除 `off` 外，模型與強度必須明確顯示，涵蓋維持、未知及延後。
- Documented implicit-invocation limitations and local reinstall checks without promising an always-on hook. 說明隱式觸發限制及本機重裝檢查，不承諾常駐觸發。
- Reduced user modes to `off`, `ask`, and `auto`, with `ask` as the default and current conversation settings as the fallback. 模式收斂為 `off`、`ask`、`auto`，預設使用 `ask`，並以目前對話設定為備援。
- Replaced the blanket App executor rule with per-operation capabilities, allowing mixed automatic and user-only actions. 移除 App 全面手動限制，改為逐項能力判斷，支援自動與使用者操作混合執行。
- Kept model catalogs dynamic and separate from current configuration; scoring is task-based instead of permanently tied to model names. 模型清單改為動態資料並與目前設定分離；評分以任務需求為準，不永久綁定模型名稱。

## [0.3.0] - 2026-09-07

### Added

- Cross-platform manifests for ChatGPT/Codex, Claude Code, and Gemini CLI.
- English and Traditional Chinese public documentation.
- Architecture and complete routing examples.
- Portable validation and platform-specific release packaging.
- Public contribution and security policies.

### Changed

- Prepared the two routers for a shared cross-platform release.
- Kept `recommend` as the conservative default for both independent routers.

## [0.2.0] - 2026-09-07

### Added

- Shared runtime capability detection and executor-resolution policy.
- Environment baseline and routing-gate revalidation.
- Independent `off`, `recommend`, `ask`, `auto_safe`, `auto`, and `locked` modes.

## [0.1.0] - 2026-09-06

### Added

- Initial `task-context-router` and `research-model-router` Skills.
