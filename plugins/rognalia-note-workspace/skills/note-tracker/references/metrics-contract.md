# 参考指標の記録契約

## 現行recordの単位

schema version 2の一recordは、ブラウザ版noteダッシュボードの一つの対象期間について、記事一件またはアカウント全体を一時点で観測した結果である。`metrics/history.jsonl`へ追記し、過去recordを更新・削除しない。

共通して次を持つ。

- `observed_at`: 画面を確認した時刻。
- `data_as_of`: 画面に表示された集計時刻。取得できたデータが一つでもある時は必須。
- `dashboard_surface`: `note_browser_dashboard`。旧指標が残るアプリ画面を混ぜない。
- `period`: 開始日、終了日、`bounded`または`all_time`、`completed`または`includes_current_day`。
- `scope`: `article`または`account`。

`completed`は観測日より前に終了した期間、`includes_current_day`は観測日当日までを含む途中期間にだけ使う。増減比較は原則として同じ長さの`completed`同士で行う。

記事scopeのoriginは次の二つに分ける。

- `workspace_draft`: note Workspaceで作った記事。`article_revision`と対応する`draft_saved` registry eventのSHA-256を必須にする。
- `existing_public_article`: 導入前等からある公開記事。存在しないworkspace revisionやregistry hashを付けない。

両方とも安定した`article_id`、表示タイトル、`https://note.com/...`の公開URLを持つ。公開URLは明示port、末尾`/`、query、fragmentを含まないschema準拠の正規形だけを受け付け、runtimeで別形を黙って正規化しない。private下書きURLは受け付けない。アカウントscopeでは`article`をnullにし、架空の記事情報を作らない。

## 現行の5指標

schema version 2では、次の五項目を必ず一件ずつ持つ。

| metric | 単位と意味 | 主な取得元 |
|---|---|---|
| `impressions` | note内で記事が表示された回数 | `note_browser_dashboard` |
| `page_views` | 記事ページが開かれた回数 | `note_browser_dashboard` |
| `likes` | 選択期間中に新たに付いたスキ件数 | `note_browser_dashboard` |
| `comments` | 選択期間中に新たに付いたコメント件数 | `note_browser_dashboard` |
| `sales` | 選択期間中の売上額（円） | `note_browser_dashboard` |

各項目は`metric`、`status`、`value`、`source`、`reason`を持つ。

- `available`: `value`は0以上の整数、`reason`はnull。`source`は実際の取得元。
- `unavailable`、`not_visible`、`fetch_failed`、`not_applicable`、`not_collected`: `value`はnull、`reason`は空でない説明。
- `not_collected`は目的に不要な項目を意図して省いた時に使う。全項目を毎回取得するために操作を増やさない。
- `not_observed`は取得元がなかった時だけ使い、`available`とは組み合わせない。
- 異なる画面、期間、scopeの値を推測で補完しない。

## 流入元

`referrers`は通常ダッシュボードで確認した表示名とPVを、アカウントscopeにだけ保存する。記事scopeでは`not_applicable`とし、記事別へ推測配分しない。割合は丸めや集計差の影響を受けるため保存必須にせず、流入元PVの合計を上段PVと一致するよう補正しない。

表示名は分類の観測である。`no referrer`を直接訪問、検索domainを掲載順位や検索需要、`chatgpt.com`等をAI回答内の引用、外部domainを相談や契約の証拠へ置き換えない。

## 旧schemaとの境界

schema version 1は旧`views`、`likes`、`comments`の既存recordを検証できる状態で残す。新しい観測にはversion 2を使う。旧`views`を`impressions`または`page_views`へ変換せず、二つを足して旧`views`を作らない。version 1と2は同じhistoryで共存できるが、同じ系列として増減率を計算しない。

## 再試行と回復

- 同じrequest IDと同じpayloadは既存recordを返す。
- 同じrequest IDでpayloadが違う時は停止する。
- 同じ指標定義、scope、対象期間、`observed_at`の重複recordは拒否する。旧version 1と現行version 2は別の指標定義として扱う。
- 同じ期間の再取得は新しい`observed_at`で追記する。
- `fetch_failed`後の成功は新しいrecordで残し、失敗を消さない。
- 取得値が前回より小さくても勝手に補正しない。画面変更、取消し、集計窓等の可能性を観測として残す。

## local保存と外部境界

記録scriptは選択済み利用者workspaceの`metrics/history.jsonl`だけへ追記する。note、Web、browser、scheduled task、クラウド、source repositoryを操作しない。Cookie、認証情報、画面HTML、スクリーンショット、private URLをhistoryへ保存しない。
