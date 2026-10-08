# Task Context Router：繁體中文參考

可見介面與實際執行目的地分開辨識；手機／網頁不代表工作在該裝置執行，本機 shell 也不代表 App 可建立或移交對話。Context-only 不抓模型清單；目的地模型未知不阻止 Context 建議。交接中的設定提示必須標明來源／時間，並在目的地重新確認。

## 角色

這個 Skill 在大量工作開始前判斷任務應留在目前 Context、攜帶精簡交接移至新 Context，或從乾淨 Context 開始。它只負責路由，不執行主要任務，也不選擇模型。

## 必須遵守的共同規範

每次路由前必須讀取 Plugin 的 `shared/runtime-routing-policy.md` 與 `shared/defaults.yaml`。使用者希望的自動程度與目前環境實際能力要分開判斷；第一次先讀取能力快照，再偵測缺少或過期的項目，後續 Routing Gate 只做新鮮度檢查。Context 建立與 handoff 建立能力分開記錄。未知能力視為只能由使用者操作，只有觀察到宿主完成操作才能宣稱 `applied`。

## 被宿主直接選中時

只有使用者明確要求「僅 Context 路由」、查詢／切換 Context 模式，或 `adaptive-task-routing` 已標記為協調委派時，才由本 Skill 直接輸出。模式指令依共用政策立即處理，只確認實際值與作用範圍，不評估 Context。若宿主在一般實質任務中直接選到本 Skill，而且使用者預期同時取得 Context 與 Model 建議，立即停止子流程，讀取 `../adaptive-task-routing/SKILL.md` 並只轉交一次；轉交前不得先輸出單獨的 Context 結果。傳遞內部 `delegated_from: task-context-router` 標記；協調入口再次載入本 Skill 時會帶入協調委派標記，此時不得再次轉交。

## 觸發時機

協調入口處理只要求計畫或分析的任務時，先完成並呈現該交付內容，再為其中的實質下一階段執行本 Skill。使用者要求執行時，先提出精簡且可操作的計畫，再於修改或大量執行前評估。直接要求只判斷 Context 時，理解請求後即可執行。只有遇到真正的階段邊界才重新評估，不要因每個小型追問觸發。

## 核心選項

- `CURRENT`：現有歷史仍相關，而且延續性有價值。
- `HANDOFF`：下一階段只需已確認的結論、限制、檔案及未決問題。
- `CLEAN`：獨立性、盲測或避免資訊污染比延續性更重要。

將實際 Context 與延續理由交給協調入口，再傳給 Model Router：哪些資訊仍有用、哪些需要重建，以及交接／設定成本。此資訊影響切換價值，但不選擇模型。保留對話不證明快取命中，新對話也不代表設定變更沒有成本。使用者拒絕交接時傳入實際保留的對話；Router 關閉時只記錄目前位置，不宣稱已評估適合程度。

## 控制模式

- `off`：不執行 Router，留在目前 Context。
- `ask`：未設定模式時使用此預設。建議 `CURRENT` 時直接繼續；建議改變時先詢問是否調整。拒絕就沿用目前 Context；接受後，可呼叫且可驗證的操作由 AI 執行，否則提供已知手動步驟，讓使用者在目的地自然接續，不要求回覆特定口令。
- `auto`：在工具、權限與安全限制允許時自動套用。

使用者目前回合的明確要求優先。Context 模式與 Model 模式彼此獨立。

使用者可在對話中說「這次關閉對話路由」、「這個對話的 Context Router 改成 auto」或「目前 Context 模式是什麼」。模式控制只回報變更後的值與作用範圍；若要求跨新對話保存但宿主沒有可寫入的使用者設定區，改為套用目前對話並明確說明限制。不得修改套件內的 `shared/defaults.yaml`。

## 輸出與交接

結構化證據必須區分建議與實際處置，包含 `recommendation`、`confidence`、`reason`、`mode`、`disposition`、`handoff_required`、`runtime_capabilities` 與 `execution`。一般使用者輸出不顯示 `CURRENT`／`HANDOFF`／`CLEAN` 英文代碼，直接依結果寫「留在目前對話」、「切換到新對話並帶入精簡交接」或「開啟全新對話，不帶入目前脈絡」。其他語言使用相同語意的在地化描述。選擇 `HANDOFF` 時，只攜帶目標、已確認需求、決策理由、相關產出、目前狀態、未決問題及下一步；不得攜帶秘密、無關歷史、隱藏推理或逐字稿。只能由使用者操作時，必須提供符合目前介面的精確步驟。

## 與 Model Router 的順序

```text
要求的分析或可操作計畫 → task-context-router → 確定 Context
→ research-model-router → 確定模型設定 → 依授權與未決事項繼續或詢問
```

這個 Skill 決定「在哪裡執行」；`research-model-router` 決定「用多少模型能力執行」。

完整順序由 `adaptive-task-routing` 協調 Skill 負責；本 Skill 只有在宿主誤將一般任務直接分派給子 Skill 時轉交協調入口，本身不呼叫 Model Router。直接的 Context-only 請求只處理 Context。`ask` 的建議被拒絕時，實際工作 Context 仍是目前對話。App 與 CLI 都要逐項確認可操作與可驗證能力，不能只依介面名稱判斷。

## 行動優先顯示

依 [UX 契約](../../../shared/routing-ux.md)，先顯示對話動作及原因，再明確回答是否需要開新對話。啟用時精簡版也不省略；關閉不宣稱目前對話適合。模型保留不能蓋過尚待使用者決定的交接。只繼續已授權工作；只要求計畫不代表可以實作。
