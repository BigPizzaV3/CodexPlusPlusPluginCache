# 週間計画契約

## 保存対象

週間計画は`plans/weekly/YYYY-Www.md`へ保存する。strategyの定期実行は、利用者が不在でも`strategy_recommendation`として推奨候補を保存できる。このrecordは`confirmed_by_user: false`であり、利用者の確定判断ではない。利用者が採用、修正、差し替え、休止、別テーマを選んだ場合は`user_selection`として別revisionへ保存する。

入力は[`schemas/weekly-plan-input.schema.json`](schemas/weekly-plan-input.schema.json)に従う。保存されるrevision metadataは[`schemas/weekly-plan-revision.schema.json`](schemas/weekly-plan-revision.schema.json)に従う。

## 候補

各候補は次を持つ。

- `candidate_id`: 週内とrevision間で追跡するID。
- `direction`: 仮タイトルではなく記事の方向。
- `audience`と`reader_value`。
- `article_role`: `record`、`relationship`、`expertise`、`work`、`revenue`、`other`。
- `source_card_ids`: 中心にする一次情報カード。
- `material_status`: `ready`または`needs_more_source`。
- `missing_information`と`research_questions`。
- `why_now`と`estimated_effort`。

`ready`には一つ以上の実在する最新有効cardが必要である。`needs_more_source`は不足情報を一つ以上明記する。privateまたは要確認cardは内部計画の材料にできるが、記事本文での使用承認にはならない。

## 本数と休止

`desired_article_count`は上限の目安であり、候補数はそれより少なくてよい。候補数を埋めるために薄い案を追加しない。

戦略担当の推奨は`record_type: strategy_recommendation`、`decision: recommend`、`confirmed_by_user: false`で保存する。推奨には一つ以上の候補が必要である。

今週書かない利用者の判断は`record_type: user_selection`、`decision: pause`、`confirmed_by_user: true`、`desired_article_count: 0`、空の`candidates`として保存できる。これはworkspace全体のcadenceを自動で休止する操作ではない。

## revisionと再試行

最初の保存はrevision 1である。最初は推奨、利用者による採用、または休止を保存できる。推奨後に利用者が採用する場合は新しいrevisionを追記する。同じ週を修正、差し替え、休止する場合も同じMarkdownへ新しいrevisionを追記し、過去revisionを残す。最新revisionだけを現在状態として扱う。

利用者確定後の同じ週へ、定期実行が新しい推奨を上書きしてはならない。利用者が確定後に変更する場合は、必ず新しい`user_selection`として記録する。

同じ`request_id`と同じ入力の再試行はduplicateとして既存revisionを返す。同じ`request_id`で内容が異なる場合は停止する。plan lockが存在する場合は削除せず停止する。

metadataはbase64url化したJSONをHTML commentへ保存し、入力hash、本文hash、source card revisionを持つ。さらに、`note-tracker`のcanonical validatorを通した`metrics/history.jsonl`だけから、戦略担当が読んだprefix長とhash、確認時刻、event数、直近request/run、観測・記録時刻、直近eventの項目別statusを`tracking_review`として持つ。旧schema version 1では3項目、現行version 2では5項目をそのまま残す。payload hash、article参照、重複等が壊れた履歴へreceiptを付けない。後から計測eventが追記されても過去prefixを再検証でき、読んでいない将来eventを当時の判断材料に装えない。validatorはrevision順、hash、card参照、metrics prefix、本文改変を検査する。

## 外部操作

週間計画の保存は利用者workspaceへのlocal書き込みだけである。記事執筆、note操作、公開、クラウド同期、scheduled task作成を始めない。
