# 画像briefと保存契約

## 1. 目的

画像工程へ記事全文を渡さず、確定済みの記事revisionと小さなbriefを結び付ける。生成不能時もbriefを残し、生成できた時はQAを通過した完成画像だけを追記型で保存する。

## 2. brief

`prepare_image_brief.py`は、利用者workspaceの絶対pathと[`schemas/image-brief-input.schema.json`](schemas/image-brief-input.schema.json)に従うconfigを受け取る。

configは次だけを持つ。

- 対象記事ID、revision、記事metadataの相対path、確定タイトル。
- 読者が読む理由、記事固有のフック、主役と場面。
- 採用済みのデザイン構造、表現、正確な短いcopyまたは文字なし指定、禁止事項。
- copyの描画方法。copyがある時は`same_generation`、文字なしなら`none`とし、生成後の文字合成を許可しない。
- 参照画像の有無と使い方。画像本体や絶対pathは保存しない。
- 差し絵の場合だけ、その一件への利用者承認と挿入位置。
- 現在の画像生成能力が`available`か`unavailable`か。

本文、noteタグ、X投稿文、生ログ、private背景、長い会話履歴はbriefへ含めない。

保存先は次とする。

```text
assets/{article-id}/thumbnail-brief-r001.json
assets/{article-id}/inline-brief-r001.json
```

同じrequest IDと同じ内容は既存briefを返す。同じrequest IDで内容が異なる時は停止する。方向を変えて作り直す時は新しいrequest IDで次のbrief revisionを作り、旧briefを残す。

## 3. 完成画像

`save_image_asset.py`は次を受け取る。

- 保存済みbriefのworkspace相対path。
- 正確な目標寸法へ整えた画像。見出し画像は、確認用previewを再現できる8-bit RGBまたはRGBA・非interlace PNGに限定する。差し絵はPNGまたはJPEGを受け付ける。
- [`schemas/image-qa-input.schema.json`](schemas/image-qa-input.schema.json)に従うQA結果。

QA結果は画像生成完了時刻`generated_at`と目視QA完了時刻`reviewed_at`を持つ。保存scriptの`--timestamp`はasset保存時刻`saved_at`として扱う。`記事保存 <= brief作成 < generated_at < reviewed_at <= saved_at`を満たさない入力は拒否する。metadataとregistryには三時刻を別fieldで残し、保存時刻を生成時刻と装わない。

見出し画像は1280×670px、差し絵は1280×720px以外を受け付けない。`exact_copy`がある見出し画像は、visualとcopyを同じ一回の画像生成で完成させた画像だけを受け取り、後載せした文字を完成物として扱わない。寸法調整scriptが行うのは切り抜きと縮小だけで、文字追加や装飾合成は行わない。RGBAの縮小はalpha事前乗算で行い、完全透明pixelの隠れた色を境界へ混ぜない。入力は50MB以下、built-in経路のsource・targetは各1,600万pixel以下とし、PNGの展開量がheaderの宣言寸法を超える場合や圧縮streamが不正な場合は停止する。安全性エラーを任意backendへ迂回しない。QAは最終PNGから作った320×168pxを実表示し、そのSHA-256を`preview_sha256`へ持つ。差し絵では同fieldを`null`にする。未解決事項が一件でもある画像を保存しない。

完成物は次へ保存する。

```text
assets/{article-id}/thumbnail-r001.png
assets/{article-id}/thumbnail-r001-preview.png
assets/{article-id}/thumbnail-r001.json
assets/{article-id}/inline-r001.png
assets/{article-id}/inline-r001.json
assets/{article-id}/registry.jsonl
```

画像を作り直した場合は次のasset revisionへ保存し、旧画像を上書きしない。見出し画像の320×168px previewは、QA対象と最終画像の関係を後から検証できるよう完成assetの一部として保存する。失敗候補、比較sheet、一時fileは保存しない。

## 4. 差し絵

差し絵は`inline_approved=true`と具体的な挿入位置があるbriefだけを使う。完成後のQAへ次を含める。

- `caption`: 節との関係が自然に伝わる一文。制作説明や見出しの言い換えにしない。
- `alt`: 見えている人物、物、動作、関係を80字以内の平文で説明する。宣伝文、キーワード列、URLを入れない。

見出し画像の`caption`と`alt`は`null`にする。

## 5. 追跡と完全性

briefは対象記事metadata、記事draft、文脈パック、記事registry eventを検証し、記事metadataのSHA-256を保存する。画像metadataと画像registryは、brief、完成画像、QA、metadataのhashを保持する。見出し画像ではpreview path、preview hash、元となった最終画像hashも保持する。

`validate_image_assets.py`は次を検出する。

- 記事revision、brief、画像、metadata、registryの欠損または差し替え。
- 目標寸法、file形式、path、hashの不一致。
- 見出し画像previewの欠損、最終画像hashとの不一致、最終画像からの決定的な再生成結果との不一致。
- request IDの重複、asset revisionの欠番。
- QA未完了、未解決事項、差し絵のcaptionまたはALT欠損。
- `記事保存 <= brief作成 < generated_at < reviewed_at <= saved_at`を満たさない時刻、metadataとregistryの時刻不一致。

## 6. 外部境界

scriptが書くのは選択済みlocal workspaceの`assets/`配下だけである。画像生成toolの呼び出し、note、Web、SNS、クラウド、source repository、Skill install先、タスク作成を実行しない。標準出力と保存eventの`external_actions`は常に空である。

`ready_for_draft`は、完成画像を後続の新規下書き登録工程へ渡せる状態を示すだけであり、noteへ登録済みまたは公開済みという意味ではない。

標準5タスク運用では、このeventと保存scriptの`article_id`、`article_revision`、`asset_revision`、`image_path`、`preview_path`を画像制作タスクから記事制作タスクへの完了receiptとして使う。記事制作タスクは画像validatorを通し、完成画像を利用者へ納品してから下書き登録を確認する。画像taskの起動、brief保存、生成候補だけを完了receiptにしない。
