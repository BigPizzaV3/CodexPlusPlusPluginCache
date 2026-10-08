# 保存方式とデータ設計

## 1. 基本方針

メモ、記事、画像、指標は、利用者が選んだPC内のworkspaceへ保存します。note Workspaceには、ROGNALIAが利用者データを預かる共通データベースはありません。

同梱のセットアップとadapterはローカル保存を扱います。Google Drive、Dropbox、private GitHub等への接続・同期は含まれません。

ファイルの保存先と、AIが情報を処理する場所は別です。会話へ送った内容やAIが読み取る資料には、利用中のAIサービスのデータ取扱条件が適用されます。ローカル保存でも、外部AIへ渡す権限のない資料は使用しないでください。

## 2. source repositoryとruntime workspaceを分ける

この公開リポジトリへ置くもの:

- Skill本体。
- 公開可能なテンプレート。
- 合成テスト。
- 導入・利用・安全・カスタマイズの説明書とデータ形式。

利用者のruntime workspaceへ置くもの:

- 目標とプロフィール。
- 通常運用ガイドと現在のlifecycle phase。
- 一次情報ログと一次情報カード。
- 週間計画。
- 記事本文、記事台帳、参考指標。
- 生成画像と出典記録。

runtime workspaceをこの公開リポジトリの中へ作らず、既定では別フォルダへ作ります。

## 3. 標準workspace

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
│   ├── standing-instructions-history.jsonl
│   ├── style-profile-history.jsonl    初回profile保存時に追加
│   └── style-profile-history/         初回profile保存時に追加
├── strategy/
│   ├── strategy.md
│   ├── operating-settings.json
│   ├── role-task-plan.md
│   ├── role-task-bindings.jsonl
│   └── change-history.jsonl
├── primary-log/
│   └── YYYY/
│       └── YYYY-MM.jsonl
├── source-cards/
│   └── cards.jsonl
├── context-packs/
│   ├── registry.jsonl
│   └── {article-id}.md
├── plans/
│   └── weekly/
│       └── YYYY-Www.md
├── articles/
│   ├── registry.jsonl
│   ├── drafts/
│   └── note-drafts/              承認package作成時に追加
├── metrics/
│   └── history.jsonl
└── assets/
    └── {article-id}/
```

workspace全体の保存先とフォルダ名は利用者が選べます。内部の管理ファイル名と相対パスは上の構造で使用します。保存先を移す時は、末尾の移行手順で各タスクの参照先も更新します。

`START_HERE.md`は、選択したtask名、task mode、機能の希望を反映した利用者向けの短い説明書です。普段の入口、担当別の使い方、現在の設定と定期実行の状態を確認する場所を示します。運用判断や外部状態の正本ではありません。

`STUDIO.md`は、セットアップ後に標準5taskまたは1task簡易運用が同じ契約で動くためのhost共通runtime guideです。`AGENTS.md`はCodex用adapterとして`STUDIO.md`を参照し、独自の運用判断を持ちません。別hostへ対応する時も、host固有fileから同じ`STUDIO.md`へつなぎます。

`workspace.json`、`operating-settings.json`、setup入力、task binding、継続指示のschema version 1を[`note-workspace-setup`のschema](../skills/note-workspace-setup/references/schemas/)で定義しています。manifestはruntime guide、運用設定は`operation` phase、task topology、自然文入口を記録します。生ログのschema version 1・2、一次情報カードと記事別文脈パックのschema version 1を[`note-source-log`のschema](../skills/note-source-log/references/schemas/)で定義しています。週間計画入力とrevision metadata、戦略変更入力とeventのschema version 1を[`note-strategist`のschema](../skills/note-strategist/references/schemas/)で定義しています。記事一式の入力、draft metadata、記事台帳eventのschema version 1を[`note-writer`のschema](../skills/note-writer/references/schemas/)、画像brief、QA、asset metadata、画像registry eventのschema version 1を[`note-image`のschema](../skills/note-image/references/schemas/)、下書き承認package、開始event、非公開保存結果のschema version 1を[`note-draft`のschema](../skills/note-draft/references/schemas/)、文体プロフィール入力、metadata、eventを[`note-style-profile`のschema](../skills/note-style-profile/references/schemas/)で定義しています。指標観測入力と履歴eventを[`note-tracker`のschema](../skills/note-tracker/references/schemas/)で定義しています。

`role-task-plan.md`は役割名、開始指示、受け渡しの計画です。taskやheartbeatが実際に作成済みであることを示す正本にはしません。`prepare_role_task_kickoff.py`はtaskとhostに結び付くランダムな一回限りchallengeを`strategy/task-binding-challenges/`へ保存します。adapterが公式host機能から読み戻した開始・ready messageを`verify_role_task_readback.py`が照合し、challengeをverifiedへ進めたtaskだけを`role-task-bindings.jsonl`へ追記します。receiptはtask専用nonce、workspace IDと絶対path、継続指示revision、hostで読み戻した開始・ready message IDと本文hash、host evidence hash、challenge proof hash、検証時刻を持ちます。binding成功時にchallengeをconsumedへ進め、別bindingへの再利用を拒否します。platform側のlive read-backとlocal binding receiptは両方必要です。構成を変える時はgenerationを増やし、旧generationは現在のready対象に戻しません。

`operating-settings.json`の`automation_preferences`には、定期実行を希望するか、人が読めるschedule、対象roleだけを保存します。外部automationのID、作成済み状態、次回実行はcacheしません。これらの現在値はplatformを正本とし、読み戻せない場合は`未確認`として重複作成を止めます。これにより、古いlocal状態を現在のscheduled taskと誤認しません。

`profile/standing-instructions.json`は全taskで毎回守る現在の指示、同名Markdownは人とAIが読む表示、historyは承認済みの変更履歴です。記事一件だけの指示、文体プロフィール、戦略変更を混ぜません。現在JSON、Markdown、履歴が一致しない時は更新を止めます。

## 4. IDと追跡

### ログID

各入力へ一意な`log_id`を付けます。日付と衝突しにくい識別子を使い、原文や追加回答を別recordとして追跡します。既存recordの内容は静かに変更しません。

日記の会話は生ログのversion 2を使います。共通の`conversation_id`でやり取りをまとめ、本人とAIを`speaker`で区別します。AIの質問・返答も残せますが、本人の一次情報カードの根拠にはできません。従来のversion 1の原文は書き換えず、同じフォルダで読み取れます。会話recordを扱う場合は対応版のSkillを使ってください。

### 一次情報カードID

各カードは`source_card_id`と、元になった一つ以上の`log_id`を持ちます。AIが追加した解釈は、利用者の原文と区別します。更新時は同じIDの新しい`revision`を追加します。

### 記事ID

各記事は`article_id`を持ちます。タイトル変更や公開URLの追加があっても同じ記事ならIDを維持します。

### 文脈パック

文脈パックは、正規化済み入力、参照した`source_card_id`とrevision、card event hash、作成日、目的、未確認事項を含みます。`context-packs/registry.jsonl`は、記事ごとの承認とpack全体のhashを本文とは別に追記します。記事本文から使用時点の一次情報へ戻れ、validatorは記録した入力と作成時点の最新card revisionから本文を再構築し、registry eventと照合します。

## 5. 生ログ

生ログは追記式を原則とします。過去の入力を静かに書き換えません。

最低限の項目:

```json
{
  "schema_version": 1,
  "log_id": "log-20260823-aaaaaaaa",
  "request_id": "req-log-synthetic-0001",
  "recorded_at": "2026-08-23T20:00:00+09:00",
  "input_type": "text",
  "original_text": "利用者が入力した原文",
  "parent_log_id": null,
  "follow_up_question": null,
  "visibility": "confirm_before_use",
  "status": "active",
  "content_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "payload_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

- `original_text`を要約で置き換えない。
- 任意の質問へ後から回答が届いた場合は、`input_type`を`follow_up_answer`とした新recordを作り、`parent_log_id`で元入力へつなぐ。
- `request_id`と内容が同じ再試行では二件目を作らない。同じIDで内容が異なる場合は停止する。
- hashは再試行と改変の検査に使い、公開承認の代わりにはしない。
- 削除依頼があった場合は、対象、バックアップ、Git履歴や同期先への残存可能性を説明してから処理する。

上のhashは形式を示すための値です。実際の値はscriptが原文と対象fieldから計算します。

## 6. 一次情報カード

カードは執筆で使いやすい小単位です。

最低限の項目:

```json
{
  "schema_version": 1,
  "event_id": "evt-synthetic0001",
  "event_type": "created",
  "request_id": "req-card-synthetic-0001",
  "source_card_id": "src-aaaaaaaaaaaa",
  "revision": 1,
  "source_log_ids": ["log-20260823-aaaaaaaa"],
  "kind": "observation",
  "statement_type": "experience",
  "summary": "本人の観察を事実の範囲で短く記述",
  "exact_words": null,
  "topics": ["例となるテーマ"],
  "public_scope": "confirm_before_use",
  "status": "active",
  "created_at": "2026-08-23T20:05:00+09:00",
  "updated_at": "2026-08-23T20:05:00+09:00",
  "payload_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

`kind`は、出来事、観察、感情、判断、発言、変化、問い等を区別します。固定分類に合わない入力を無理に変換しません。

`statement_type`は、確認できた事実、本人の経験、推論、不明を区別します。`exact_words`は、本人の言葉を正確に残す意味があり、元ログ内に完全一致する場合だけ使います。記事へ使えるかは`public_scope`を確認します。

カードの修正は`cards.jsonl`へ新しい版を追記します。最大`revision`が現在値です。過去版を消したり、同じ版番号を書き換えたりしません。

## 7. 記事別文脈パック

記事別文脈パックは、選んだカードの最新有効版だけを次の三つへ分けたMarkdownです。

- 記事へ使用できる材料。
- 公開前確認が必要な材料。
- その記事での使用承認がない、非公開の背景。

先頭のmetadataへ、schema version、`request_id`、`article_id`、作成日時、正規化済み入力、使用したカードID・revision・event hash、記事ごとの承認、入力と本文のhashを残します。別のregistry eventへ同じ承認、card revision、pack全体のhashを追記します。validatorは、作成日時までに存在した最新card revision、入力から再構築した本文、registry eventを照合します。作成日時を保ったままmetadata、本文、registryを過去revisionへ戻す変更や、registryを変えずに記事承認を足してhashを再計算する変更は停止します。新規packの作成日時が選択cardの更新日時より前の場合も保存しません。同じ記事IDの既存fileは上書きしません。

これらはlocal file間の事故、部分的な変更、不整合を見つける完全性検査です。同じ権限でcard履歴、pack、registry、日時、hashをすべて一貫して書き換えられる相手への改ざん証明ではありません。

## 8. 週間計画

週間計画は`plans/weekly/YYYY-Www.md`へ、人間が読める本文とbase64url化したrevision metadataを一緒に保存します。戦略heartbeatの未確定推奨と、利用者が決めた選択を別record typeで残します。

各revisionは次を保持します。

- 対象週、連番revision、`request_id`、記録日時。
- `strategy_recommendation`または`user_selection`。
- 推奨、採用、修正、差し替え、今週の休止と、`confirmed_by_user`。
- 投稿本数の目安と候補。
- 候補ごとの読者価値、役割、材料状態、不足情報、調査論点。
- 参照したsource card ID、revision、要約、公開範囲等のsnapshot。
- 入力と表示本文のhash。

同じ週を変える時も旧revisionを消しません。最新revisionだけを現在状態として扱い、過去の推奨と判断へ戻れるようにします。利用者確定後の同じ週へ、自動推奨を追加できません。snapshotは計画時点の根拠であり、source card自体の公開承認や記事本文への使用承認ではありません。

## 9. 戦略変更履歴

`strategy/change-history.jsonl`は、目標、希望頻度、最低限の頻度、継続・休止状態の承認済み変更を追記します。各eventはbefore、after、変更理由、request ID、日時、連番revision、hashを持ちます。

現在値は`profile/creator-profile.md`、`strategy/strategy.md`、`strategy/operating-settings.json`で一致させます。変更eventと現在値が一致しない時は自動修復せず、validatorが停止します。テーマ、読者、公開範囲、保存先等の構造的変更はsetup側の変更契約で扱います。

## 10. 記事台帳

記事台帳は追記型eventとして、制作状態と各revisionのfileを対応させます。`note-writer`は、タイトル選択後に`draft_saved` eventを`articles/registry.jsonl`へ一行追記します。

各eventは最低限、次を持ちます。

- `article_id`、`request_id`、連番`revision`、保存日時。
- 確定タイトルと`ready_for_image`状態。
- 参照した文脈パック、draft Markdown、metadata JSONの相対path。
- 文脈パック、draft、metadata、入力payloadのhash。
- 週間候補を使った場合は、週、plan path、plan revisionとsegment hash、record type、利用者確定の有無、candidate ID。
- 外部操作を行っていないことを示す空の`external_actions`。

本文とnoteタグは`articles/drafts/{article-id}-rNNN.md`、制作判断、調査source、タイトル候補、X投稿文は同名のJSON metadataへ分けます。改稿時は旧fileを上書きせず、同じ記事IDの次revisionを追加します。同じrequest IDと同じ内容は重複を作らず、同じrequest IDで内容が違う時は停止します。

画像は`draft_saved` eventへ仮置きせず、`assets/{article-id}/registry.jsonl`の`image_saved` eventで記事revisionと結びます。noteの非公開下書きURLは、保存、非公開、editor終了を実画面で確認した時だけ`articles/note-drafts/`の結果へ記録します。公開URLと公開日は後続の計測・公開同期契約で追加し、取得できないURLを作りません。

## 11. 画像briefとasset

画像工程は`ready_for_image`の記事revisionと確定タイトルから、記事全文を含まない小さなbriefを作ります。

```text
assets/{article-id}/thumbnail-brief-r001.json
assets/{article-id}/thumbnail-r001.png
assets/{article-id}/thumbnail-r001-preview.png
assets/{article-id}/thumbnail-r001.json
assets/{article-id}/inline-brief-r001.json
assets/{article-id}/inline-r001.png
assets/{article-id}/inline-r001.json
assets/{article-id}/registry.jsonl
```

briefは読者が読む理由、記事固有のフック、主役と場面、採用済みの構造、短いcopyまたは文字なし条件、copyの描画方法、禁止事項だけを保持します。copyがある見出し画像は`same_generation`、文字なしは`none`とし、生成後の文字合成を許可しません。記事metadataのpathとhashを持ち、本文、noteタグ、X投稿文、生ログ、private背景、長い会話履歴は保存しません。生成能力がない場合も`generation_unavailable`としてbriefだけを残します。

完成画像は見出し画像1280×670px、差し絵1280×720pxだけを受け付けます。見出し画像は最終PNGから決定的に作った320×168px previewを目視確認し、preview hashをQAへ結び付けます。保存時に同じpreviewを再生成してasset履歴へ残すため、無関係な小画像へ差し替わっていないことを後から検証できます。差し絵は利用者の明示希望、具体的な挿入位置、caption、80字以内のALTを必須にします。画像metadataとregistryは`generated_at`、`reviewed_at`、`saved_at`を分け、`記事保存 < 画像生成 < 目視QA <= asset保存`を検証します。

QAを通過した時だけ画像、metadata、`image_saved` eventを保存します。brief、画像、metadataはSHA-256でeventへ結び、同じ種類の作り直しは次のasset revisionへ追記します。同じrequest IDと同じ内容は既存結果を返し、同じIDで内容が違う時は停止します。`ready_for_draft` eventとimage path、preview pathは画像taskから記事制作taskへの完了receiptです。記事制作taskはvalidatorで対象記事との一致を確認し、記事と画像を納品してから下書き登録を確認します。`ready_for_draft`はnoteへ登録済みまたは公開済みという意味ではありません。

## 12. note新規下書き登録

完成物への記事ごとの承認後、`note-draft`は次を作ります。

```text
articles/note-drafts/{article-id}-registration-r001.json
articles/note-drafts/{article-id}-result-r001.json
articles/note-drafts/registry.jsonl
```

registration packageは本文を複製せず、記事draftとmetadata、QA済み見出し画像、希望済み差し絵、本文内URL、指定済み追加URLのpathとhashを持ちます。承認前のread-only delivery manifestが現在の最新記事revisionと全完成物を一つの`delivery_sha256`へ固定します。固定の承認文、全画像asset保存より厳密に後の承認時刻、`new_note_draft_once` scopeを同じpackageへ結びます。全体の時刻順は`記事保存 < 画像生成 < 目視QA <= asset保存 < 利用者承認`であり、asset保存と承認が同時刻の入力も拒否します。

最初の外部入力直前に`note_draft_started` eventを追記します。保存、非公開、editor終了を確認した時だけresult fileと`note_draft_saved` eventを追記します。開始済みで結果がない状態は`pending`として残し、別の新規下書きを自動作成しません。

下書きURLは利用者workspace内のprivate情報です。source repository、公開eval、公開ログへ移しません。resultがないpackageを登録済みと扱わず、下書きURLを推測で作りません。

## 13. 参考指標の履歴

指標は上書きせず、現行ブラウザ版は`note-tracker`のschema version 2で取得時点ごとに追記します。旧schema version 1の`views` recordも変換せず同じ履歴で保持します。

```json
{
  "schema_version": 2,
  "event_type": "metrics_observed",
  "request_id": "req-metrics-example-0001",
  "payload_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "workspace_id": "nw-example001",
  "run_id": "run-metrics-example-0001",
  "collection_mode": "manual",
  "observed_at": "2026-09-09T17:00:00+09:00",
  "data_as_of": "2026-09-09T16:02:00+09:00",
  "recorded_at": "2026-09-09T17:01:00+09:00",
  "dashboard_surface": "note_browser_dashboard",
  "period": {
    "range_type": "bounded",
    "start_date": "2026-08-12",
    "end_date": "2026-09-08",
    "completeness": "completed"
  },
  "scope": {"type": "account", "article": null},
  "metrics": [
    {"metric": "impressions", "value": 1000, "status": "available", "source": "note_browser_dashboard", "reason": null},
    {"metric": "page_views", "value": 120, "status": "available", "source": "note_browser_dashboard", "reason": null},
    {"metric": "likes", "value": 8, "status": "available", "source": "note_browser_dashboard", "reason": null},
    {"metric": "comments", "value": 0, "status": "available", "source": "note_browser_dashboard", "reason": null},
    {"metric": "sales", "value": null, "status": "not_collected", "source": "not_observed", "reason": "今回の目的では収益を確認しなかった"}
  ],
  "referrers": {
    "status": "available",
    "source": "note_browser_dashboard",
    "items": [
      {"referrer": "note.com", "page_views": 80},
      {"referrer": "Google", "page_views": 30}
    ],
    "reason": null
  },
  "note": "手動計測の合成例",
  "external_actions": []
}
```

上のhashは形式を示すための値です。実際のeventではscriptが正規化済み入力とworkspace IDから計算します。

`unavailable`、`not_visible`、`fetch_failed`、`not_applicable`、`not_collected`を必要に応じて区別します。いずれも`0`ではありません。記事scopeではWorkspace記事を記事台帳event hashへ結び、導入前の公開記事へ存在しないrevisionを作りません。流入元はアカウントscopeにだけ保存し、上段PVと合うように補正しません。

## 14. 保存とバックアップ

同梱のセットアップでは、PC内の保存先を一つ選びます。PC故障や誤操作に備え、workspace全体のバックアップを用意してください。書き込み中のファイルを一部だけコピーすると、本文と履歴が異なる時点の状態になることがあります。

既存の同期アプリが管理するフォルダに置く場合は、同期先の共有範囲と履歴保存を確認してください。note Workspaceが同期を制御する機能はありません。同じworkspaceを複数端末から同時編集せず、復元後はvalidatorで本文・設定・履歴の整合を確認します。

## 15. 同時書き込みと同期を追加する場合

- 初回は一方向の保存先を一つ決める。
- 双方向同期は競合解決を定義できる場合だけ実装する。
- 同じファイルを複数タスクが同時に書き換えない。
- 生ログと指標履歴は追記式にする。
- localで生ログ、カード、文脈パックを同時に扱う時は、この順でlockを取得する。残ったlockは別processが動いていないことを確認するまで自動削除しない。
- 週間計画は計画用lock、戦略変更は変更用lockを使う。validatorも同じlockを使い、既存lockを自動削除しない。
- task bindingと継続指示はそれぞれ専用lockを使う。継続指示は現在JSON、Markdown、履歴を一つの更新として揃える。
- 画像briefとassetは画像用lockを使う。見出し画像はQA対象とhashが一致したpreviewだけを完成assetへ残し、失敗候補や比較用小画像は残さない。
- 文体プロフィールの複数file保存はwrite-ahead journalと開始時current hashを使う。強制終了後はPIDが終了済みのlockだけを引き継ぎ、同じrevisionを完了してから再試行を判定する。競合current、新しいregistry、形式不明lockを自動上書き・削除しない。
- 計画やプロフィールの更新では、更新者、日時、変更理由を残す。
- 同期失敗を成功扱いにせず、ローカルの完成物を失わない。
- private GitHubを選んだ場合も、認証情報をworkspaceへ保存しない。

## 16. 移行と持ち出し

利用者がnote Workspaceをやめる場合も、MarkdownとJSONLのファイルを手元へ残します。特定のSaaSやdatabaseがなければ読めない形式にしません。

保存先を変更する時は、次を確認します。

1. 新旧の対象フォルダ。
2. 移すデータと移さないデータ。
3. 画像等の大きなファイル。
4. 旧保存先を残すか削除するか。
5. scheduled taskと各タスクが参照する場所の更新。
