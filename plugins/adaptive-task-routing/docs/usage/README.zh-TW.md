# Adaptive Task Routing — 使用指南

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

**先知道下一步怎麼做，也知道何時值得維持現況。**

Adaptive Task Routing 在重要工作階段開始前，評估對話環境、模型與推理設定。先顯示現在建議的動作，再用一句話解釋原因。適合任務的模型，不代表工作進行到一半就值得切過去。

判斷會考慮任務需求、目前設定是否足夠、剩餘工作量、對話延續與切換成本。保留適任設定也是正式結果；資訊不足時會說「暫時沿用」，不冒稱已確認適合。實際節省與可靠度改善仍需要證據。

## 運作方式

1. AI 先交付你要求的發現，或提出可執行計畫。
2. 路由區塊先顯示動作：維持、暫時沿用、開新對話、調整設定，或請你決定。啟用對話路由時，仍明確回答是否需要開新對話。
3. 預設 `ask` 在變更前或遇到關鍵阻礙時詢問；保留與不妨礙進度的不確定性，不中斷已授權工作。只要求計畫不等於授權實作。

簡短問題與未改變的階段不重複路由。對話與模型分開判斷；交接到新對話時也可能需要調整模型。

## 安裝

### Gemini CLI

```bash
gemini extensions install https://github.com/zyzdev/adaptive-task-routing-gemini --ref v0.5.0
```

安裝完成後，請重新啟動 Gemini CLI。

### Claude Code

公開目錄申請正在審查中。在正式上架前，可先複製專用 repository，並以 plugin 目錄啟動 Claude Code：

```bash
git clone --branch v0.5.0 https://github.com/zyzdev/adaptive-task-routing-claude.git
claude --plugin-dir "$PWD/adaptive-task-routing-claude"
```

### ChatGPT 與 Codex

從 [v0.5.0 Release](https://github.com/zyzdev/adaptive-task-routing/releases/tag/v0.5.0) 下載 `adaptive-task-routing-openai-0.5.0.zip`。若介面支援本機 Plugin，請解壓縮後透過該介面的 Plugin 或 Marketplace 功能加入。公開目錄是否可用仍以 OpenAI 審查結果為準。

## 第一次使用

啟用 Plugin 後，開新對話輸入：

> 請檢視這個專案並提出改善計畫，先不要修改檔案。

需要時可明確要求使用 adaptive-task-routing Skill。AI 應先交付計畫，再附路由建議；這段請求沒有授權實作。

## 你會看到什麼

以下是不同情境的範例，接在使用者要求的計畫或分析之後。「維持設定」範例假設核對工作已獲授權；只要求計畫時則以交付計畫結束。模型與原生推理設定僅為示意，依平台而異；「目前 AI」必須有實際觀察依據。

**不值得切換時**

```text
---

### Adaptive Task Routing

✓ 維持目前設定

目前設定足夠，而且剩餘工作不多，切換帶來的改善有限。

對話：留在目前對話，不需開新對話。
目前 AI：GPT-5.6 Sol / high。

不需操作，接著執行已授權的核對。
```

**值得切換時**

```text
---

### Adaptive Task Routing

↑ 建議調整 AI 設定

下一階段的驗證需求超過目前已觀察設定的能力。

對話：留在目前對話，不需開新對話。
任務適配設定：GPT-6 Astra / high。

要改用 GPT-6 Astra / high 嗎？
```

實際控制依平台提供。`auto` 只有驗證成功才說已套用；無法代為操作時說明實際處理方式。若目前設定資訊不足，改顯示「暫時沿用設定」、有用的任務適配設定與不確定原因；真正阻礙品質或進度的問題才需要你決定。

只要求計畫時，結尾會說明已交付計畫、尚未開始實作。需要交接時，顯示「對話：建議開新對話並交接必要脈絡，待你確認」，並提供下一階段需要的事實、限制與交接摘要。

## 模式與詳細程度

| 模式 | 行為 |
| --- | --- |
| `ask`（預設） | 變更前或有關鍵阻礙才詢問；保留與不阻礙工作的 defer，直接繼續已授權工作。 |
| `auto` | 只有切換值得、已授權、平台支援且能驗證時才套用；無法操作就說明實際結果，不忽略重大阻礙。 |
| `off` | 跳過指定 Router 及其輸出。 |

Context 與 Model 可分別設定。可直接說「這次關閉對話路由」、「模型路由改用 ask」或「這個對話的兩個路由都改用 auto」。單純改模式不授權任何工作。

預設顯示精簡版。說「顯示詳細說明」可查看**最低足夠設定、任務適配設定與升級理由**。適配設定回答本階段適合用什麼；建議動作回答現在應該做什麼。詳細版重用原評估，切換分數只供診斷；compact／detailed 是顯示偏好，不是額外模式。

確認保留時，精簡版只顯示已觀察的目前 AI；其他適配設定留到詳細說明。暫時沿用也可能來自切換成本或效益不明，不限於目前 AI 未知。

## 建議根據什麼？

- **對話環境：** 評估下一個任務需要沿用哪些資訊，以及舊任務的假設或限制是否可能干擾新工作，再建議保留對話、整理資訊後交接，或從新對話開始。
- **模型與推理強度：** 考量任務難度、模糊度、錯誤成本與驗證需求，提供最低足夠及任務適配設定，並說明提高設定是否值得。
- **模型資訊來源：** 優先使用目前環境可取得的資訊；無法取得時，依平台使用套件內有效的參考資料。參考資料不代表你的帳號一定能選用該模型。

完整判斷原則與平台限制可查閱[設計與架構](../architecture.zh-TW.md)。

## 明確啟用

- 支援 Skill 提及的 Codex 介面：`$adaptive-task-routing`
- Claude Code：`/adaptive-task-routing:adaptive-task-routing`
- 其他介面：輸入「開始這項工作前，請使用 adaptive-task-routing Skill。」

## 移除

Gemini CLI：

```bash
gemini extensions uninstall adaptive-task-routing
```

Claude Code 若使用 `--plugin-dir` 啟動，結束該 Session 並刪除複製的目錄即可。ChatGPT 或 Codex 則從原本用來安裝的 Plugin 或 Marketplace 介面停用或移除。

## 疑難排解

- 安裝或更新後，請開啟新對話。
- 確認 Skill 清單包含 `adaptive-task-routing`、`task-context-router` 與 `research-model-router`。
- 沒有出現建議時，可先明確啟用 Skill 測試一次。
- 顯示建議不代表宿主已切換模型或對話；只有通過驗證的自動變更才會回報為已套用。

開發與驗證細節請回到[開發說明](https://github.com/zyzdev/adaptive-task-routing/blob/main/DEVELOPMENT.zh-TW.md)。
