# Behavioral cases / 行為案例

Use these cases for manual or automated forward evaluation. Judge observable decisions, executor resolution, and absence of false claims; do not require exact wording. Each case includes the same expectation in English and Traditional Chinese.

以下案例供人工或自動前向評估使用。應檢查可觀察的決策、執行者解析與是否避免錯誤宣稱，不要求逐字相同。每個案例均提供相同的英文與繁體中文預期。

## 1. Coordinator sequence / 協調入口順序

**Given:** A substantial debugging request explicitly invokes `adaptive-task-routing`, with both child Skills and shared files available.

**Expect:** Present the requested findings or actionable plan first. Load and delegate context then model decisions. The single routing note uses a divider, localized brand heading, action, reason, enabled conversation advice and useful AI setting. In ask, retain/nonblocking defer continue only authorized work; a proposed change or material blocker requires a real decision. The coordinator does not make either child decision itself.

**中文：** 先交付要求的分析或計畫，再依序委派兩個 Router。單一路由区塊先動作、原因，再顯示啟用的對話去留建議及有用 AI 設定。ask 只確認變更或關鍵阻礙；保留與非阻礙 defer 只繼續已授權工作。

## 2. Improvement-plan delivery / 交付改善計畫

**Given:** The user asks only for a substantial cross-file release-flow, cross-platform consistency, and test-gap audit. The completed findings propose a concrete implementation and validation phase.

**Expect:** Complete the substantial audit and plan first, then show action-first advice for its concrete next phase. A plan-only request ends with that deliverable without implementation or an artificial keep-current question. Compact preserves enabled conversation advice and useful model guidance; detailed can expose both task settings.

**中文：** 完成稽核與計畫後給出精簡建議；只要求計畫不實作，也不製造保留確認問題。對話路由啟用時仍回答是否需要開新對話。

## 3. Context continuity with localized visible advice / 對話延續與在地化建議

**Gemini installed-extension regression:** Run a fresh CLI session with the installed extension,
no workspace `GEMINI.md`, and no explicit Skill or output-format request. Ask for a document
consistency and test-gap audit with an improvement plan. With both routers enabled, the completed
findings must be followed by one visible conversation sentence explaining whether a new conversation is needed
and reason before useful AI settings, even when the model switch is retained or deferred. Repeat
with context routing explicitly off to verify that a conversation assessment is then omitted.
Do not count a workspace projection test as installed-extension coverage.

**Gemini 安裝版回歸：** 在已安裝 extension 的全新 CLI 對話中，不放工作目錄 `GEMINI.md`、
不指定 Skill 或輸出格式，要求文件一致性與測試缺口分析及改善計畫。兩個路由均啟用時，
完整發現之後、必要 AI 設定之前，必須顯示對話建議、是否需要開新對話與原因，即使模型切換
被保留或延後也不能省略。另測明確關閉 Context 時不評估對話；工作目錄投影測試不算安裝版覆蓋。

**Given:** A follow-up depends on definitions and corrections from recent turns, and the running model and effort are both observed and suitable.

**Expect:** Preserve continuity using a localized conversation advice and a verified keep action. Keep both task settings in internal evidence; compact may show the observed current pair. Ask does not pause for retention; continue only authorized work. A pending context change remains independent.

**中文：** 保留有用脈絡與已確認適任的設定；ask 不為保留而停下，只繼續已授權工作。模型保留不能蓋過未解決的對話決策。

## 4. Unknown current configuration / 目前設定未知

**Given:** The applicable model catalog, supported effort options and task-relevant capability descriptions are known, but the running model and reasoning effort cannot be read.

**Expect:** Unknown current values do not erase an evidenced task-fit pair. Use provisional retention and defer automatic switching without claiming suitability or showing a selector. Ask continues already authorized work if no material blocker exists; a concrete quality/destination blocker requires a useful question, not a generic keep-current confirmation.

**中文：** 目前模型未知時用暫時沿用並顯示有依據的任務適配設定，不宣稱適合或附選單。無關鍵阻礙則繼續已授權工作，否則問一個具體問題。

## 5. Unknown catalog / 模型清單未知

**Given:** Neither the current configuration nor supported model options are available.

**Expect:** After a bounded relevant discovery attempt or a concrete access limitation, report task needs, unknown current model and effort, and the missing catalog evidence. No model identifier is invented. Provisional CURRENT/CURRENT is unverified, not suitable; excluding a subagent menu alone is not a completed catalog exploration.

**中文：** 完成有界探索或確認具體存取限制後，若仍無目前設定與適用清單，應顯示任務需求、未知的目前模型與強度及缺少的清單證據，不得捏造型號。暫留 `CURRENT/CURRENT` 時使用 `unverified`，不能說現況適合；只排除子代理選單不算完成清單探索。

## 6. Independent off combinations / 獨立 off 組合

**Given:** Test three configurations: both modes `off`, context only `off`, and model only `off`.

**Expect:** Both off produces no routing evaluation, capability probe, or routing note. Context-off keeps the current context and runs only enabled model routing. Model-off runs only context routing and emits no model recommendation. No third coordinator mode is consulted.

**中文：** 分別測試兩者均 `off`、只有 Context 為 `off`、只有 Model 為 `off`。兩者均關閉時不評估、不探測能力、不輸出路由訊息；Context-off 留在目前 Context，只執行啟用的 Model Router；Model-off 只執行 Context Router，不輸出模型建議；不得另查第三套入口模式。

## 7. Mixed App capabilities / App 混合能力

**Given:** An App surface uses `auto`. Its orchestrator can create a new context and set a model for that new run, but it cannot switch the current model or effort.

**Expect:** Each operation retains its own capability. Context creation may run automatically and be reported `applied` only after verification. Current-model and effort changes degrade to optional known user actions while the retained current setting is recorded; the App label does not cap all operations to `user_only`.

**中文：** App 使用 `auto`，其 Orchestrator 可建立新 Context 並設定新執行的模型，但不能切換目前模型或強度時，每項操作應保留自己的能力。Context 建立可自動執行，且只有驗證後才回報 `applied`；目前模型與強度降級為可選的已知使用者動作，並記錄沿用目前設定，不能因介面是 App 就把全部操作都限制為 `user_only`。

## 8. Programmable CLI execution / 可程式化 CLI 執行

**Given:** A CLI uses `auto`.

**Expect:** Automatic execution occurs only when the exact operation is callable, authorized, and verifiable. An interactive command or launch flag alone is not capability evidence. After one failed automatic attempt, the router stops retrying and returns an accurate manual fallback without an `applied` claim.

**中文：** CLI 使用 `auto` 時，只有該項操作確實可呼叫、已授權且可驗證才自動執行。互動式指令或啟動參數本身不構成能力證據。自動操作失敗一次後停止重試，提供正確手動替代方式，且不得宣稱 `applied`。

## 9. Deferred destination / 目的地延後

**Given:** Context mode is `ask`, a handoff is recommended, and the prospective destination's model catalog is unknown.

**Expect:** The model gate is visible but deferred: current observable fields are shown, recommendation model and effort are `null`, `assessment` is `deferred`, and disposition remains awaiting the unresolved context decision. The model gate is rerun in the confirmed destination before execution.

**中文：** Context 模式為 `ask`、建議 handoff，且預定目的地的模型清單未知時，Model Gate 仍需顯示但標為延後：呈現目前可觀察欄位，模型與強度建議為 `null`，`assessment` 為 `deferred`，`disposition` 對應尚未解決的 Context 決定。進入已確認目的地後、執行前重新評估 Model Gate。

## 10. Missing child or shared dependency / 缺少子元件或共用依賴

**Given:** The coordinator cannot load one child `SKILL.md` or a required shared policy/defaults file from either packaged paths or host resources.

**Expect:** It reports the named component as unavailable and the gate as incomplete. It does not fabricate a child result, silently substitute the coordinator's own judgment, or continue as though the full gate succeeded.

**中文：** 協調入口無法從套件路徑或宿主資源載入某個子 `SKILL.md`，或缺少必要共用政策／預設檔時，應指出缺少的元件並標示 Gate 未完成；不得捏造子元件結果、由入口私自代判，或假裝完整 Gate 已成功。

## 11. No recursion and duplicate-gate reuse / 避免循環與重複 Gate

**Given:** The coordinator has completed a gate, and ordinary follow-ups keep the same phase, effective context, preferences, model catalog, and capabilities.

**Expect:** During a coordinated run, children do not call the coordinator or each other. A child selected directly for a general task dispatches once to the coordinator, whose delegated marker prevents recursion. The existing gate is reused without another routing note. A real model-only stage transition reruns only the model router; context is reconsidered only at a genuine context boundary.

**中文：** 協調流程已啟動時，子元件不得回呼入口或彼此呼叫；宿主若在一般任務中直接選到子元件，子元件只轉交入口一次，協調委派標記必須避免循環。一般後續回合的階段、實際 Context、偏好、模型清單與能力均未改變時，重用既有 Gate、不重複輸出。只有模型需求改變時只重跑 Model Router；真正遇到 Context 邊界才重評 Context。

## 12. Compact handoff and clean evaluation / 精簡交接與乾淨評估

**Given:** One task transitions from completed exploration to stable implementation, while another explicitly requests blind independent evaluation.

**Expect:** The first may recommend `HANDOFF` containing only necessary state and no transcript or hidden reasoning. The second recommends `CLEAN` without a task handoff. Difficulty alone does not force either choice.

**中文：** 一項任務從已完成探索轉入穩定實作，另一項明確要求盲測式獨立評估時，前者可建議 `HANDOFF`，只攜帶必要狀態、不含逐字稿或隱藏推理；後者建議不附交接的 `CLEAN`。不能只因任務困難就強制選擇兩者之一。

## 13. Remote host without installation / 遠端主機未安裝

**Given:** A user believes the plugin is installed locally, but the active task runs on another host whose plugin source and task Skill inventory do not contain Adaptive Task Routing.

**Expect:** Diagnosis first identifies the actual execution host, then checks that host's installation source and the current task's Skill inventory. It reports only the evidenced mismatch. A missing routing note alone is not blamed on an old window, stale inventory, or description matching.

**中文：** 使用者認為 Plugin 已安裝在本機，但實際任務執行於另一台主機，且該主機的 Plugin 來源與任務 Skill 清單都沒有 Adaptive Task Routing 時，應先確認實際執行主機，再查該主機的安裝來源與目前任務清單，只回報有證據的落差。不能只因沒看到路由訊息，就歸因於舊視窗、清單過期或描述匹配失敗。

## 14. Stage transition / 階段轉換

**Given:** A deterministic batch completes and the next phase compares competing hypotheses or interprets consequential validation evidence.

**Expect:** Model routing is reconsidered before the reasoning-heavy phase. Context routing is not repeated unless a genuine context boundary also exists. Completion with no substantial next phase adds no artificial gate.

**中文：** 確定性批次工作完成，下一階段要比較競爭假設或解讀重要驗證證據時，應在高推理需求階段前重新評估 Model Router；除非同時存在真正的 Context 邊界，否則不重跑 Context Router。工作完成且沒有實質下一階段時，不額外製造 Gate。

## 15. First-use capability snapshot / 首次能力快照

**Given:** No capability snapshot exists on first invocation, and the host exposes read-only capability metadata plus a user-managed settings store.

**Expect:** The router detects context creation, handoff creation, current-model switching, new-run model selection, and effort control separately, then stores results with surface/fingerprint, evidence, observation time, and confidence. A later unchanged gate performs only a freshness check. A permission, tool, host, session, or failed-operation change invalidates only affected observations. Nothing is written into the installed plugin package.

**中文：** 第一次執行沒有能力快照，而宿主提供唯讀能力資料與使用者管理的設定區時，Router 應分別偵測 Context 建立、handoff 建立、目前模型切換、新執行模型設定與強度控制，再連同介面／指紋、證據、觀察時間及信心保存。後續未改變的 Gate 只做新鮮度檢查；權限、工具、宿主、Session 或操作失敗只使受影響的觀察失效。不得寫入已安裝 Plugin 套件。

## 16. Dynamic model catalog and scoring / 動態模型清單與評分

**Given:** A cached model catalog exists, then a new session exposes a changed runtime catalog with one model added and one removed.

**Expect:** The new runtime catalog replaces the stale cache for decisions. The running configuration is still observed separately. Task needs are scored independently of model names and mapped only to current capability evidence. A user-provided list is labeled, and a static fallback is used only when versioned and unexpired; no removed or unknown model is recommended from stale data.

**中文：** 已有快取模型清單，但新 Session 的 Runtime 清單新增一個模型並移除一個模型時，決策應改用新的 Runtime 清單，且目前執行設定仍分開觀察。任務需求評分不綁模型名稱，只對應目前能力證據。使用者提供的清單要標記來源；靜態備援只有具版本且未過期才使用；不得從過期資料建議已移除或未知模型。

## 17. Conversational mode control / 對話模式控制

**Given:** In a normal conversation with no writable persistent settings store, the user sets Adaptive Task Routing to `auto` for this conversation, then changes only model routing to `ask`, and asks which modes are active.

**Expect:** Treat the requests as configuration commands before ordinary plugin-question skipping. The unqualified change sets both independent routers; the named change affects only Model. Confirm Context `auto`, Model `ask`, and conversation scope concisely without model discovery, a routing recommendation, or a second confirmation. Do not claim that a new conversation will inherit the setting, and do not treat a mode change as authorization to implement another task.

**中文：** 在沒有可寫入持久設定區的一般對話中，使用者先把 Adaptive Task Routing 設為本對話使用 `auto`，再只把 Model Router 改為 `ask`，最後查詢目前模式。這些要求應先被視為設定指令；未指定 Router 的切換同時套用兩者，具名切換只影響 Model。以精簡訊息確認 Context `auto`、Model `ask` 與目前對話範圍，不探測模型、不產生 Routing 建議，也不要求第二次確認。不得宣稱新對話會沿用，也不得把模式切換當成其他任務的實作授權。

## Cross-platform release matrix / 跨平台發布矩陣

Machine-readable source: [behavioral-matrix.json](behavioral-matrix.json). B01–B17 preserve the scenarios above; P01–P05 and N01–N03 are the OpenAI submission set. The [surface matrix](surface-matrix.json) adds R01–R10 and S01–S12 and records all 47 cases separately on seven surfaces: ChatGPT web/desktop/mobile, Codex App/CLI, Claude Code and Gemini CLI (329 cells). Its per-surface results are authoritative; the legacy four-host summary below does not establish individual surface passes. All results start as `not_run`; native validation or inventory discovery does not prove behavioral success.

Use a fresh conversation for each independent case. P05 and B11 require a controlled multi-turn sequence. Record host version, observed model/effort (or unknown), invocation mode, loaded resource paths, result and evidence. Synthetic capability fixtures must never be treated as authority to call real operations. Use the host's actual controls for manual tests; unknown or user-only operations must remain honestly reported.

| ID | Type | Setup | Prompt | Expected behavior |
|---|---|---|---|---|
| P01 | positive | Fresh chat; both modes ask; tiny synthetic bug fixture; no real changes authorized. | Use adaptive-task-routing to inspect a multi-step retry bug and propose a debugging plan. Do not implement it. | Load coordinator, context router and model router in order, resolve shared files, display context plus model/effort or unknown; keep implementation unstarted. |
| P02 | positive | Fresh chat; plugin enabled; provide a synthetic small service description; ask modes. | Review our service architecture and propose a substantial implementation and validation plan for splitting the worker queue. | The primary coordinator description should be selected. If the host selects either child instead, its direct-selection guard dispatches once to the coordinator. Route the proposed next phase with Context and Model blocks before yielding; no implementation from a plan-only request. |
| P03 | positive | Recent turns contain a corrected schema needed next; invoke only task-context-router. | Use task-context-router to choose the context for implementing the schema corrections we just agreed on. | Load only context router and shared policy, record CURRENT internally when continuity is needed, and show localized plain-language advice without the raw enum; do not produce a model recommendation or call the coordinator. |
| P04 | positive | Synthetic deterministic pilot completed; substantial robustness review next; exact catalog/current controls supplied as test fixtures, not real capabilities. | Use research-model-router before comparing competing explanations for the pilot validation results. | Load model router and policy, visibly report model and reasoning; use only evidenced options; do not choose a context or execute simulated capabilities. |
| P05 | positive | Complete a coordinator gate, then provide a synthetic passing batch report; interpretation is authorized. | The batch validation is complete. Continue by evaluating confounding and alternative explanations. | Before interpretation re-run model routing. Reuse context unless a real boundary exists; report unknown fields honestly and respect independent modes. |
| N01 | negative | Fresh chat; implicit selection test, no explicit Skill mention. | In one sentence, what is a retry loop? | Answer briefly; no routing evaluation, capability probes, switch recommendation, or routing note. |
| N02 | negative | Fresh chat with a scratch text containing 'teh'; this is the entire authorized task. | Change only 'teh' to 'the' in this sentence: teh cat sat. | Make only the tiny correction; no routing gate or model/context switch. |
| N03 | negative | Fresh chat; no substantial follow-up work requested. | What are the names of the three Skills in this plugin? Only list their names. | List the three names; no routing evaluation, capability probe, model suggestion or invented next phase. |

| Suite | ChatGPT | Codex | Claude Code | Gemini CLI |
|---|---|---|---|---|
| P01–P05 (5 positive) | not_run | not_run | not_run | not_run |
| N01–N03 (3 negative) | not_run | not_run | not_run | not_run |
| B01–B17 (17 boundary cases) | not_run | not_run | not_run | not_run |

Explicit invocation: select the coordinator Skill in ChatGPT/Codex; Claude uses `/adaptive-task-routing:adaptive-task-routing`; Gemini asks to use the named Skill and may require activation consent. Test P02, N01–N03 without naming any Skill. Evaluate trigger accuracy separately from correctness after explicit activation. The generated Gemini coordinator is self-contained: its normal gate must not request additional sibling Skill or plugin-level shared-resource access, and a missing dependency appendix leaves the gate incomplete.

## Switching acceptance cases / 切換驗收案例

S01–S12 in `surface-matrix.json` cover suitable-model retention, quality deficits,
unknown current settings and costs, new or declined handoffs, router-off/model-only
paths, reasoning changes, returning to a warm cache, remaining-work amortization,
explicit user targets and phase-boundary churn. These are forward-evaluation fixtures;
all new results are `not_run`. Static package tests do not establish live routing
behavior, cache hit rates or workflow savings. Changed expectations reset affected
results; historical evidence files remain historical observations.

S01–S12 涵蓋適任模型維持、品質缺口、目前設定及成本未知、新建或拒絕交接、
路由關閉／模型專用、推理調整、切回仍可用的快取、剩餘工作攤提、使用者指定設定，
以及避免階段內反覆切換。新增結果均為 `not_run`；靜態封裝測試不能證明即時路由行為、
快取命中率或工作成本節省。預期已變更的既有結果重設，歷史證據檔仍只代表當時觀察。

## Action-first UX cases / 行動優先 UX 案例

U01–U14 in `surface-matrix.json` cover authorized keep, provisional continuation, quality blockers, plan-only completion, justified changes, manual-only auto, handoff plus settings, unresolved destinations, independent modes, clean starts, detail requests and explicit targets. These are acceptance specifications, not recorded live passes.

U01–U14 是驗收規格，涵蓋授權、保留、未知、阻礙、交接、獨立模式與詳細顯示；本次僅做離線契約及封裝檢查，不代表三平台模型已通過。

### Cross-platform UI regression

For plan-only audits, inspect the whole response: complete findings and plan, then divider and
one final routing note. A greeting before the note or a plan split around it fails. The reported
Gemini response put the note first and used a default-only current AI label; offline fixtures
now reject both defects. They cannot verify whether a named model was actually observed.
Review retention evidence for current identity, phase quality and the choice to retain, including
Gemini native default reasoning versus unknown model identity. Use the exact shared Traditional
Chinese action line and a separate short reason. Future implementation stays conditional.
