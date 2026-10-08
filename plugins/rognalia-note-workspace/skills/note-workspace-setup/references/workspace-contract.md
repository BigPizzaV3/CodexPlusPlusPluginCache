# workspace契約

## 基本

workspaceは利用者が所有する。公開source repository、Plugin cache、Skillのinstall先と分ける。同梱adapterはlocal保存だけを扱い、クラウド同期や外部databaseを作らない。

## 作成される構成

```text
note-workspace/
├── AGENTS.md
├── README.md
├── START_HERE.md
├── STUDIO.md
├── workspace.json
├── profile/
│   ├── creator-profile.md
│   ├── style-profile.md
│   ├── standing-instructions.md
│   ├── standing-instructions.json
│   └── standing-instructions-history.jsonl
├── strategy/
│   ├── strategy.md
│   ├── operating-settings.json
│   ├── role-task-plan.md
│   ├── role-task-bindings.jsonl
│   ├── task-binding-challenges/  # task準備確認時に作成
│   └── change-history.jsonl
├── primary-log/
│   └── YYYY/
│       └── YYYY-MM.jsonl
├── source-cards/
│   └── cards.jsonl
├── context-packs/
│   └── registry.jsonl
├── plans/
│   └── weekly/
├── articles/
│   ├── registry.jsonl
│   └── drafts/
├── metrics/
│   └── history.jsonl
└── assets/
```

`START_HERE.md`は、利用者が迷った時に読む個別化された短い説明書である。選択したtask構成、実際のtask名、機能の希望を反映し、普段の入口、担当別の使い方、定期実行の現在状態をplatformで確認する方法を示す。運用判断や外部状態の正本ではなく、内容が食い違う時は`STUDIO.md`、構造化設定、platformのlive read-backをそれぞれの対象について優先する。

`STUDIO.md`は、初回セットアップ後にAIが執筆サポーターとして動くためのhost共通runtime guideである。`AGENTS.md`はCodexが`STUDIO.md`を自動発見するためのadapterであり、運用判断の正本にしない。別hostのadapterも同じ`STUDIO.md`を参照する。

`workspace.json`はworkspace自体の識別子、schema version、runtime guideを持つ。`strategy/operating-settings.json`は運用設定、task topology、cadenceの継続・休止状態、現在のlifecycle phase、定期実行の希望scheduleの正本であり、記事本文や一次情報を含めない。外部automationの作成状態、対象task、次回実行は保存せず、platformを正本にする。初回作成が完了したworkspaceは`operation` phase、cadenceは`active`である。

`profile/standing-instructions.md`は、複数taskで毎回守ることを利用者が明示した指示だけを持つ。記事一件の指示を全体へ昇格せず、文体はstyle profile、目標や頻度はstrategyへ分ける。機械可読な現在値は`profile/standing-instructions.json`、更新履歴は`profile/standing-instructions-history.jsonl`へ保存する。`strategy/change-history.jsonl`は承認済みの目標、頻度、休止変更、`strategy/role-task-bindings.jsonl`は実際にreadyを確認した利用者向けtaskのbindingを追記するための空fileとして作る。`strategy/task-binding-challenges/`は役割taskの準備確認を始めた時だけ作り、ランダムなnonceごとに`issued`、`verified`、`consumed`を残す。hostから読み戻したmessage本文自体はworkspaceへ複製せず、bindingへhashだけを残す。

## schema

- 入力: [`schemas/setup-config.schema.json`](schemas/setup-config.schema.json)
- workspace manifest: [`schemas/workspace-manifest.schema.json`](schemas/workspace-manifest.schema.json)
- 運用設定: [`schemas/operating-settings.schema.json`](schemas/operating-settings.schema.json)
- task binding入力: [`schemas/role-task-binding-input.schema.json`](schemas/role-task-binding-input.schema.json)
- 継続指示入力: [`schemas/standing-instructions-input.schema.json`](schemas/standing-instructions-input.schema.json)
- 継続指示状態: [`schemas/standing-instructions-state.schema.json`](schemas/standing-instructions-state.schema.json)

schema version 1では、local保存、`START_HERE.md`による利用者案内、`STUDIO.md`への通常運用引き継ぎ、標準5タスクと1タスク簡易運用、自然文を利用者の入口にすること、記事ごとの下書き承認、取得不能値を`0`にしないことを固定する。`STUDIO.md`は、`note-writer`で一記事ずつ制作し、原稿を返す直前に`note-draft-quality`を内部で使い、品質結果ではなく納品原稿だけを返す通常運用も定める。タイトル選択後の画像は再利用する`note-image` taskへ小さなbriefで渡し、見出し画像は実寸と小表示を確認してwriterへ返す。writerが完成物を納品した後の一度の承認は`note-draft`で対象記事とQA済み画像へ固定し、新規下書き一件だけへ使う。文体見直しは`note-style-profile`で元本文を保存せず履歴化し、公開後の参考指標は`note-tracker`で項目別・時点別に追記する。一次情報ログ、カード、文脈パックのrecord schemaは[`note-source-log`](../../note-source-log/references/data-contract.md)、週間計画と戦略変更のschemaは[`note-strategist`](../../note-strategist/references/strategy-contract.md)、記事draftと記事台帳eventのschemaは[`note-writer`](../../note-writer/references/article-package-contract.md)、画像brief、QA、asset metadata、画像registry eventのschemaは[`note-image`](../../note-image/references/image-production-contract.md)、下書き承認package、開始event、保存結果のschemaは[`note-draft`](../../note-draft/references/draft-registration-contract.md)、文体プロフィールrevisionは[`note-style-profile`](../../note-style-profile/references/style-profile-contract.md)、指標履歴recordは[`note-tracker`](../../note-tracker/references/metrics-contract.md)で定義する。

## 作成の安全条件

- destinationは絶対パスで受け取る。
- source repository配下を拒否する。
- destinationが既に存在する場合は、空でも上書きしない。
- dry-runではfileやfolderを作らない。
- 本作成は同じ親folder内の一時folderで組み立て、内部検証後にdestinationへ移す。
- 失敗時は今回作成した一時folderだけを片付け、既存fileを削除しない。
- 親folderを新しく作る時は、`--create-parents`を明示する。

## 再開

destinationへ移す前に中断した場合、destinationは存在しないため同じ承認内容で再実行できる。一時folderが残った場合は、今回のscriptが作った名前と内容を確認してから別操作で片付ける。

destinationが存在する場合は自動再開や修復をしない。`validate_workspace.py`で状態を読み取り、欠損、schema差、利用者の追加fileを分けてから、移行または修復の対象を改めて承認する。
