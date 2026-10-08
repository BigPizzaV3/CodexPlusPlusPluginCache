# 文体プロフィールの保存契約

## 目的

利用者本人の文章から再利用できる書き方だけを整理し、現在版と変更履歴を利用者workspaceへ保存する。元本文、記事固有の事実、個人属性を公開Skillやプロフィールへ持ち込まない。

## 入力と根拠

- sampleは1〜5本。1本だけなら`provisional`、2本以上で利用者が確認した時は`confirmed`にできる。
- sample本文はconfigへ入れない。`sample_id`、`source_kind`、`content_sha256`、`character_count`だけを残す。
- `source_kind`は`published_article`、`draft`、`writing_sample`、`conversation_text`のいずれかとする。
- SHA-256は分析した本文全体から作り、本文そのものの代わりには使わない。
- 利用者の承認scopeは`save_style_profile_revision`に固定する。

## プロフィール形式

現在版は次の見出しを持ち、人が読んで内容を確認できるMarkdownである。変更は利用者が確認した後に保存scriptで新しいrevisionとして記録し、現在版と履歴を揃える。現在版だけを直接編集しない。

1. 基本の語り口
2. 文のリズム
3. 導入
4. 見出しと構成
5. 具体性
6. 好む表現
7. 避ける表現
8. 記事ごとに選ぶこと
9. 絶対に作らないもの
10. 今回の根拠と不確実性

各項目は実行可能な短い箇条書きにする。「自然に」「人間らしく」だけで終えない。元記事の文、固有名詞、個人的な事実、第三者情報、URL、長い引用を入れない。

## 保存物

初回revisionが1の場合は次を作る。

```text
profile/style-profile.md
profile/style-profile-history/style-profile-r001.md
profile/style-profile-history/style-profile-r001.json
profile/style-profile-history.jsonl
```

現在版は最新revisionと同一内容にする。旧revisionを上書きしない。metadataはprofileの各項目、sampleの識別情報、利用者の希望、承認時刻、保存理由、profile hashを持つ。registry eventはmetadata hashを追加してrevisionを結ぶ。

## 再試行と更新

- 同じrequest IDと同じpayloadは`duplicate`として既存revisionを返す。
- 同じrequest IDで内容が違う場合は停止する。
- 新しい確認済み変更は次revisionへ追記する。
- 既存file、既存registry event、既存lockを削除または上書きしない。
- validatorはrevision欠番、hash不一致、currentとlatestのずれ、未登録history fileを検出する。
- 複数fileの保存前に`profile/.style-profile-transaction.json`へwrite-ahead journalを作り、開始時のcurrent hashも記録する。途中で処理が止まった場合、次回の同Skill実行がjournal、history、registryを照合して同じrevisionを完了してから再試行を判定する。
- process強制終了でlockが残った場合は、lockに記録したPIDが動作中なら停止し、終了済みの場合だけlockを引き継いでjournalを回復する。形式不明のlockは自動削除しない。
- currentが開始時のhashとも保存予定profileのhashとも一致しない場合や、より新しいregistry revisionがある場合は、別変更との競合として一切上書きせずjournalを残して停止する。

## 外部境界

scriptが書くのは選択済み利用者workspaceの`profile/`配下だけである。公開Skill、Plugin cache、source repository、note、Web、クラウドを操作しない。現在の会話だけで使う場合は保存scriptを実行しない。
