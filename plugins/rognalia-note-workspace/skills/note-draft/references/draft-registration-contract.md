# note新規下書きの登録契約

## 1. 目的

完成物への一度の承認を、対象記事、画像、URLへhashで結び付ける。外部入力の開始と、非公開下書きの保存確認をlocalへ分けて記録し、状態不明時の重複登録を防ぐ。

この契約のscriptはbrowserやnoteを操作しない。browser操作はhost adapterが行い、scriptは利用者workspaceのlocal fileだけを検証・記録する。

## 2. 承認済み登録package

承認を尋ねる前に`prepare_draft_delivery.py`へ[`schemas/draft-delivery-input.schema.json`](schemas/draft-delivery-input.schema.json)に合う対象を渡し、最新記事revision、QA済み画像、挿入anchor、URLを検証する。返る`delivery_sha256`は、利用者へまとめて提示するタイトル、本文hash、タグ、画像hash、URLと挿入位置のmanifest hashである。このread-only工程はnoteやworkspaceへ書き込まない。

`prepare_note_draft_registration.py`は、その完成物を提示した後の承認と、workspaceの絶対path、[`schemas/draft-registration-input.schema.json`](schemas/draft-registration-input.schema.json)に従うconfigを受け取る。

configは次を持つ。

- 記事ID、記事revision、記事metadataの相対path。
- QA済み見出し画像metadataの相対path。
- 希望済み差し絵がある場合は、そのmetadataの相対path。
- 本文外へ追加するURLがある場合は、URLと正確な挿入位置。
- 現在の完成物への承認時刻、承認経路、固定の承認文、`new_note_draft_once` scope、提示済み`delivery_sha256`。

承認文は「noteの下書き登録まで進めますか？ 公開はしません。」とする。各画像は`記事保存 < 画像生成 < 目視QA <= asset保存`を満たし、承認は記事と全画像のasset保存より厳密に後でなければならない。同時刻は順序を証明しないため受け付けない。対象は現在の最新記事revisionでなければならない。`confirmed=true`でも、同じdelivery hashの完成物を提示した後の明示承認を確認できないagentはconfigを作らない。

packageは次へ追記保存する。

```text
articles/note-drafts/{article-id}-registration-r001.json
```

packageは本文を複製せず、記事draft、記事metadata、画像metadata、画像fileのpathとSHA-256、確定タイトル、noteタグ、見出しmarker、本文内URL、指定済み追加URLを持つ。見出しmarkerは本文行頭の`[大見出し]`と`[小見出し]`から抽出する。markerがない記事は見出しなしとして扱える。差し絵と追加URLの見出し・本文anchorは、本文内の同じsectionにそれぞれ一度だけ存在しなければならない。

同じrequest IDと同じpayloadは既存packageを返す。同じrequest IDで内容が異なる時は停止する。完成物またはURLを変えた場合は、新しい承認とrequest IDで次のregistration revisionを作り、旧packageを残す。

## 3. 開始記録

`start_note_draft_registration.py`は、最初の外部文字入力の直前に実行する。packageと参照fileを再検証し、`articles/note-drafts/registry.jsonl`へ`note_draft_started` eventを追記する。

開始eventはnote操作を実行した証拠ではなく、同じ承認packageで外部書き込みへ入る境界である。開始eventがあり、対応する保存済みeventがないpackageは`pending`として扱う。自動で別の新規下書きを作らず、note側の途中保存を照合する。

同じ記事revisionの古いregistration package、保存済みpackage、別packageの未解決開始eventは新規開始できない。

## 4. 保存結果

`record_note_draft_result.py`は、開始eventがあり、browser adapterが次を実画面で確認した時だけ、[`schemas/draft-result-input.schema.json`](schemas/draft-result-input.schema.json)に従うconfigを受け取る。

- 表示タイトルが一致した。
- 本文の冒頭と、noteタグを含む末尾が一致した。
- 大見出し、小見出しの数と内容が一致した。
- noteタグ5個または6個が本文末尾に一致した。
- 見出し画像と、指定済み差し絵が一致した。
- URLが正しいlinkとして残り、OGP表示の有無を区別した。
- 保存完了、エディター終了、非公開下書きを確認した。
- 公開、予約投稿、既存下書き上書きを行っていない。

結果は次へ保存し、`note_draft_saved` eventをregistryへ追記する。

```text
articles/note-drafts/{article-id}-result-r001.json
articles/note-drafts/registry.jsonl
```

下書きURLは利用者workspace内のprivate情報である。明示port、末尾`/`、query、fragmentを含まないschema準拠の正規形だけを結果として受け付け、runtimeで別形を黙って正規化しない。source repository、eval、公開ログへ複製しない。結果記録は成功時だけ作り、状態不明や部分入力を成功へ変換しない。

## 5. 完全性と再試行

`validate_note_drafts.py`は次を検出する。

- 記事、画像、registration package、結果file、registry eventの欠損または差し替え。
- article ID、revision、確定タイトル、path、hashの不一致。
- `記事保存 < 画像生成 < 目視QA <= asset保存 < 利用者承認`を満たさない時刻。
- request IDの再利用、registration revisionの欠番。
- 開始eventなしの保存結果、二重保存、保存後の再開始。
- 期待URLと結果URLの不足、重複、追加。
- 公開、予約投稿、既存下書き上書き、未完了検証を成功結果として記録する入力。

開始済みで保存結果がない状態はデータ破損ではなく`pending`である。validatorは件数を返し、後続agentはnote側を照合してから再開する。

## 6. 外部境界

local scriptが書くのは選択済みworkspaceの`articles/note-drafts/`配下だけである。note、Web、SNS、クラウド、source repository、Skill install先を操作しない。

`approved_for_new_draft`は承認済み内容をbrowserへ渡せる状態、`external_write_started`は重複防止の開始境界、`saved_private_draft`はadapterが保存、非公開、終了を確認した結果である。いずれも公開済みを意味しない。
