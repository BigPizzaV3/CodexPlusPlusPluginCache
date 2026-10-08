# desktop local note-tracker adapter

## 役割

`note-tracker`の観測契約を、現在利用できるbrowserとlocal file操作へ接続する。新しい観測はschema version 2で保存し、対象期間、記事またはアカウントのscope、集計時刻、取得元、statusを揃える。

## 手動計測

1. workspaceの`features.metrics_tracking.enabled`を確認する。
2. ブラウザ版noteダッシュボードで対象期間とscopeを確認する。記事scopeでは公開URLを開き、private下書きURLでないことを確認する。アカウントscopeは`article: null`とする。
3. `observed_at`と画面の集計時刻`data_as_of`を分け、期間の開始・終了日と完了状態を残す。比較は原則として同じ長さの完了期間同士で行う。
4. インプレッション、ページビュー、期間内のスキ・コメント、売上の5項目を別々に扱う。各項目に値、取得元、status、理由を持たせる。公開ページの累計スキ・コメントを、期間内のダッシュボード値へ流用しない。
5. 流入元は必要な場合だけアカウントscopeで記録し、記事scopeでは`not_applicable`とする。表示されたPVを記事別へ配分したり、合計を補正したりしない。
6. 目的上省いた項目は`not_collected`、取得手段がない場合は`unavailable`、画面にない場合は`not_visible`、取得失敗は`fetch_failed`、対象外は`not_applicable`とし、値はnull・理由は必須にする。取得できた正確な0と区別する。
7. `record_metrics_observation.py`でlocalへ追記し、validatorを通す。Workspace記事は対応する記事台帳eventへ結び、既存公開記事へ架空のrevisionを付けない。
8. 観測値、期間、scope、取得状態を短く返し、記事の良否や原因を断定しない。旧version 1の`views`は変換せず保持し、現行指標と同じ系列にしない。

browserへログインが必要な場合もCookie、認証情報、画面HTMLをworkspaceへ保存しない。表示値を確認するread-only操作だけを行い、公開、編集、下書き操作、コメント投稿を行わない。

## scheduled task

手動計測を一度通した後だけ提案する。作成前に、対象workspaceの絶対path、アカウント観測の有無、公開記事の範囲、比較期間、取得する指標、曜日と時刻、実行環境、必要なbrowser状態、書き込み先を示す。利用者が承認した場合だけ現在hostの公式scheduled task機能で作る。

計測と週間企画は別taskにする。計測側は`📊 note｜計測・公開ログ`、週間企画側は`🧭 note｜戦略・編集方針`を対象にし、同じ週はtrackerを先、strategyを後に動かす。strategy側が直近の計測完了時刻とstatusを読める間隔を空ける。計測が失敗した場合も値を`0`にせず、strategyは取得不能を明示したまま一次情報や記事台帳から推奨を作れる。次回または手動計測で回復する。taskの作成、変更、停止は`metrics/history.jsonl`とは別の外部状態として報告する。

## 能力がない時

- browserがない: 利用者からダッシュボードの対象期間、scope、集計時刻、項目別の値と取得状態を受け取る。記事scopeでは公開URLも確認する。値を得た項目は`manual_user_report`として保存し、不足は推測で補わない。
- ダッシュボードへ入れない: 状況に応じて`unavailable`または`fetch_failed`を記録する。取得できたデータがなければ`data_as_of`はnullにし、公開ページの累計値で埋めない。
- local fileへ書けない: JSON入力または観測結果を会話へ返し、保存済みとは報告しない。
- scheduled taskがない: 手動実行手順を残し、作成済みと装わない。
