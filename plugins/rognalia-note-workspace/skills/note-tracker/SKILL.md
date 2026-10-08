---
name: note-tracker
description: note Workspaceで、公開済みnote記事とブラウザ版ダッシュボードのインプレッション、ページビュー、スキ、コメント、売上、流入元を、対象期間・scope・集計時点とともに確認し、取得不能を0にせず履歴へ追記する。公開後の反応を記録したい、定期計測または手動計測を再開したい時に使う。旧ビューとの混在、記事評価、テーマの自動決定、公開や編集は行わない。
---

# note Workspace 参考指標の記録

## 役割

公開済み記事とアカウント全体の参考指標を、対象範囲と意味の違う項目を混ぜずに利用者workspaceへ追記する。数字を記事の採点や次のテーマの自動決定に使わない。

標準5task運用では`📊 note｜計測・公開ログ`が利用者向けの入口である。手動実行もheartbeatも同じworkspaceへ記録し、戦略担当が後から読める状態までを担当する。Skill名を利用者へ指定させない。

公開ページや利用者本人のcreator画面はread-onlyで確認する。このSkillはnoteの公開、編集、下書き、削除、SNS投稿を行わない。

## 必ず読むもの

- 利用者workspaceの`STUDIO.md`、`workspace.json`、`strategy/operating-settings.json`、`strategy/strategy.md`、`profile/creator-profile.md`、`profile/standing-instructions.md`。
- [`references/metrics-contract.md`](references/metrics-contract.md)。
- 定期実行または手動fallbackを扱う時は[`references/collection-operation.md`](references/collection-operation.md)。

`features.metrics_tracking.enabled`がfalseなら記録を始めず、利用者が設定変更を望む場合だけ影響を示して`note-workspace-setup`へ戻す。

## 観測範囲を特定する

現行schema version 2では、一recordを一つの対象期間における記事一件またはアカウント全体の観測にする。同じ取得runでアカウント観測一件と、目的に関係する記事観測を必要数だけ記録できる。全記事を毎回取ることは必須にしない。

記事scopeでは次のどちらかへ結ぶ。

- Workspaceで作った記事: `article_id`、記事revision、`articles/registry.jsonl`の対応event hashへ結ぶ。
- 導入前からある公開記事: `existing_public_article`として安定したlocal article IDを付け、公開URLを正本にする。存在しないdraft revisionを装わない。

URLは実際に開いた`https://note.com/...`だけを使う。schemaとruntimeで同じ正規URLを扱うため、明示port、末尾`/`、query、fragmentを除いたURLだけを入力する。検索結果の抜粋、推測URL、private下書きURLを公開記事として保存しない。

アカウントscopeでは架空の記事IDや記事URLを作らず、workspace IDへ結ぶ。通常ダッシュボードの流入元はアカウントscopeだけへ記録し、記事別へ配分しない。

## 指標を別々に観測する

schema version 2では、2026年9月8日以降のブラウザ版ダッシュボードについて`impressions`、`page_views`、`likes`、`comments`、`sales`を毎回別項目で記録する。各recordに対象期間、`completed`または`includes_current_day`、画面を確認した時刻、画面の集計時刻を持たせる。

- `impressions`: note内で記事が表示された回数。人数や記事ページを開いた回数ではない。
- `page_views`: 記事ページが開かれた回数。人数や読了ではない。
- `likes`、`comments`: 選択期間中に新たに付いた件数。公開ページの現在累計と混ぜない。
- `sales`: 選択期間の売上額（円）。受取額や利益ではない。

- `available`: 画面または利用者提供値で確認できた非負整数。正確な0を含む。
- `unavailable`: 現在の環境では取得手段がない。
- `not_visible`: 対象画面に項目が表示されていない。
- `fetch_failed`: 取得を試したが通信、認証、画面変更等で失敗した。
- `not_applicable`: その記事または取得元では対象外である。
- `not_collected`: 今回の目的には不要なため、意図して収集しなかった。

`available`以外は`value: null`と具体的な理由を必須にする。取得不能、空欄、画面にない値を`0`へ変換しない。新画面で`-`と見えた値は、読み込み完了と指標の対象期間を確認してから扱う。インプレッションの記録開始前等、0を意味しない条件では`available: 0`にしない。

流入元は表示名とPVをそのままアカウントscopeへ残し、流入元合計が上段PVと一致するよう補正しない。`no referrer`を直接訪問、Googleや`chatgpt.com`等を検索順位やAI引用の証拠へ置き換えない。

schema version 1の`views`、`likes`、`comments`は旧履歴の検証と再現のためだけに受け付ける。旧`views`をv2の`impressions`または`page_views`へ変換せず、足し合わせて旧値を復元しない。スマートフォンアプリに残る旧表示もv2へ記録しない。

## localへ追記する

現行ブラウザ版の確認結果を[`references/schemas/metrics-observation-input-v2.schema.json`](references/schemas/metrics-observation-input-v2.schema.json)へ整え、次を実行する。旧schemaは[`metrics-observation-input.schema.json`](references/schemas/metrics-observation-input.schema.json)に残す。

```bash
python3 scripts/record_metrics_observation.py \
  /absolute/path/to/user-workspace \
  --config /absolute/path/to/metrics-observation.json
```

scriptは`metrics/history.jsonl`へ一行追記するだけで、Webやnoteへ接続しない。同じrequest IDと同じ内容は既存recordを返し、同じIDで内容が違う時は停止する。同じ期間の再取得は、新しい観測時刻とrequest IDで次のrecordとして残す。

保存後は`validate_metrics_history.py`でworkspace ID、記事参照、status/value、hash、request ID、同一scope・期間・観測時刻の重複を確認する。

## 振り返りへ渡す

結果を伝える時は、観測、未収集、取得不能、前回との差を分ける。増減を見る時は同じscope、同じ定義、同じ長さの完了期間を使う。少数回の増減から原因、読了、共感、相談、契約を断定しない。

`note-strategist`へ渡す時も、生の項目、scope、期間、集計時刻を保つ。PV÷インプレッションをクリック率、スキ÷PVを満足率や読了率と呼ばず、一つの点数へまとめない。本人が残してよかった記事は、反応が小さくても候補判断から落とさない。

## 定期実行

定期実行は、手動で一度通した後、対象workspace、アカウント観測の有無、対象記事、比較期間、曜日、時刻、実行環境、権限、対象のtracker taskを示して利用者が承認した場合だけadapterから作る。計測と翌週企画は別の実行にし、tracker heartbeatをstrategy heartbeatより先に動かす。

失敗したrunも`fetch_failed`として必要な範囲を記録できる。次回または手動実行で再開し、過去recordを削除しない。scheduled task自体の作成・変更・停止はlocal記録とは別の外部状態である。

## 完了条件

- 記事scopeは実在を確認した公開記事一件へ、アカウントscopeはworkspace IDへ結び付いている。
- 現行ブラウザ版は5指標が別項目で、対象期間、完了状態、集計時刻、scopeが記録されている。
- 流入元はアカウントscopeだけにあり、記事別へ推測配分されていない。
- 旧`views`と現行の`impressions`・`page_views`を変換、合算、連続比較していない。
- 各項目の値、status、取得元、理由が整合している。
- 取得不能値を0にしていない。
- 同じ依頼の再送と異なる内容の競合を区別している。
- local validatorがpassしている。
- 標準の定期実行ではtracker taskと対象workspaceへ結び付き、後続のstrategy heartbeatより先に記録している。
- 記事評価、テーマ決定、noteへの書き込み、scheduled task作成を同時に行っていない。
