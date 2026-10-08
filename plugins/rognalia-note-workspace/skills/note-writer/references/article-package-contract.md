# 記事draftとregistryの契約

## 1. 目的

完成した一記事を、利用者workspaceへ追記型で保存する。本文とnoteタグをそのまま使えるMarkdown、制作判断と出典を確認できるmetadata、記事revisionを追えるregistry eventに分ける。

保存は原稿返却後に利用者がタイトルを一つ選び、構成、トーン、品質ゲートが完了している時だけ行う。

## 2. 入力

`save_article_draft.py`は次を受け取る。

- workspaceの絶対path。
- [`schemas/article-package-input.schema.json`](schemas/article-package-input.schema.json)に従うconfig。
- タイトルやnoteタグを含まない本文Markdown file。

configは、方向の出所、文脈パック、調査状態、質問数、承認済み構成とトーン、タイトル3案、選択タイトル、noteタグ、X投稿文、品質ゲート完了を持つ。

## 3. 保存物

記事IDが`article-example001`、revisionが1の場合は次を作る。

```text
articles/drafts/article-example001-r001.md
articles/drafts/article-example001-r001.json
articles/registry.jsonl
```

Markdownは本文と、末尾のnoteタグ一行だけを持つ。品質結果、metadata、タイトル、X投稿文を混ぜない。タイトル、タイトル候補、X投稿文、調査source、承認状態はJSON metadataへ保存する。

registryは[`schemas/article-registry-event.schema.json`](schemas/article-registry-event.schema.json)に従う`draft_saved` eventを一行追記する。metadataは[`schemas/article-draft-metadata.schema.json`](schemas/article-draft-metadata.schema.json)に従う。

## 4. revisionと再試行

- 初回はrevision 1とする。
- 改稿は同じ記事IDの次revisionとして別fileへ保存し、旧fileを残す。
- 同じrequest IDと同じ入力の再試行は`duplicate`として既存revisionを返す。
- 同じrequest IDで本文またはconfigが違う場合は停止する。
- 既存file、既存registry event、既存lockを上書きまたは削除しない。

## 5. 文脈パックとhash

保存時に文脈パックのmetadataと本文hashを検証し、別fileの`context-packs/registry.jsonl`にある一件の作成eventと完全一致することも確認する。記事IDが一致し、「記事へ使用できる材料」が一件以上あるpackだけを使う。

記事metadataとregistryは次のhashを持つ。

- 文脈パック全体。
- 入力本文。
- noteタグを付けたdraft Markdown。
- metadata JSON。
- configと本文、文脈パックから作るpayload。

`validate_article_data.py`はfile改変、context packまたはそのregistry eventの差し替え、revision欠番、path不一致を検出する。保存前と後続validatorの両方が同じ照合を行う。

## 6. 調査状態

- `completed`: 一件以上のsourceを読み、title、URL、取得日時を保存した。
- `not_needed`: 本人材料だけで目的を満たし、外部調査を増やさなかった。
- `unavailable`: 必要だったが現在の環境で調査できなかった。現在情報を断定していない。

`unavailable`を`completed`として扱わない。検索結果の抜粋だけをsourceへ登録しない。

## 7. 外部境界

scriptが書くのは選択済みlocal workspaceの`articles/`配下だけである。note、Web、SNS、クラウド、source repository、Skill install先へ書かない。標準出力の`external_actions`は常に空である。

`ready_for_image`は記事とタイトルが画像briefへ渡せる状態を示すだけであり、画像生成やnote登録が実行済みという意味ではない。

標準5タスク運用では、記事制作タスクがこの状態を確認してprimary image taskへbounded briefを渡す。画像taskの起動やmessage送信を納品完了とは扱わない。`note-image`のregistry eventが`ready_for_draft`になり、画像validatorが対象記事revisionとの一致を確認した後だけ、記事制作タスクが記事と画像を利用者へまとめて納品する。
