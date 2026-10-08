# 戦略変更契約

## 対象

この契約で変更できるのは次だけである。

- noteで達成したい最優先の目的。
- 希望する投稿頻度。
- 最低限続けられる投稿頻度。
- cadenceの`active`または`paused`状態。

読者、中心テーマ、公開範囲、保存先、cloud、note操作、task、scheduled taskは変更しない。構造的変更は`note-workspace-setup`へ戻す。

## 承認

現在値、新しい値、週間計画と定期実行への影響を提示し、利用者が変更内容を明示的に承認した後だけ[`schemas/strategy-change-input.schema.json`](schemas/strategy-change-input.schema.json)を作る。`approved_by_user`は`true`でなければならない。

## 保存

scriptは次を同じlock内で更新する。

- `profile/creator-profile.md`の目的と継続条件。
- `strategy/strategy.md`の目的、頻度、運用状態。
- `strategy/operating-settings.json`のcadence。
- `workspace.json`の更新日時。
- `strategy/change-history.jsonl`の変更event。

変更eventは[`schemas/strategy-change-event.schema.json`](schemas/strategy-change-event.schema.json)に従い、before、after、理由、request ID、revision、hashを残す。既存eventを上書きしない。

同じ`request_id`と同じ変更はduplicateとして成功扱いにできる。同じIDで内容が異なる場合、現在値と履歴が一致しない場合、対象Markdownの管理sectionを一意に特定できない場合は停止する。

## 外部状態

頻度や休止の変更はscheduled taskを自動更新しない。`automation_follow_up_required: true`は定期実行の存在確認済みではなく、希望scheduleがあるためplatformのlive確認を求めるsignalである。調整、状態報告、重複判定の前にautomation ID、対象task、schedule、次回実行を読み戻し、取得不能なら`未確認`として作成済みとも未作成とも断定せず、重複作成しない。調整が必要な場合は別の未実施操作として返す。記事、一次情報、下書き、公開状態を変更しない。
