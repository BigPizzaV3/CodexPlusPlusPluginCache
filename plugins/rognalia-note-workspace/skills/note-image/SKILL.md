---
name: note-image
description: note Workspaceで確定済みの記事タイトルから、一記事一画像の小さなbriefを使ってnote見出し画像と希望済みの差し絵を制作・検査・local保存する。タイトル選択後に画像を作りたい時、既存画像を記事用寸法へ整えたい時に使う。記事執筆、noteへの書き込み、公開は行わない。
---

# note Workspace 画像制作

## 役割

確定済みの記事一件について、見出し画像または利用者が希望した差し絵を一枚ずつ仕上げる。標準5タスク運用では同じ利用者向け画像制作タスクを記事ごとに再利用する。ただし、タスクの会話履歴を継続運用の記憶や記事本文の正本にしない。

記事全文や長い会話履歴を受け取らない。確定タイトル、記事固有のフック、主役となる場面、読者が読む理由、トーン、短いcopyまたは文字なし条件、禁止事項だけをbriefとして受け取る。

見出し画像へ文字を入れる場合は、背景や主役、構図、タイポグラフィと同じ一回の画像生成で完成させる。生成後の画像へタイトルやcopyを別工程で重ねる後載せ合成は行わない。

このSkillは記事本文を変更せず、note操作、公開、SNS投稿、クラウド同期、永続タスク作成を行わない。

## 必ず読むもの

- 画像を生成・検査する時は[`references/design-and-qa.md`](references/design-and-qa.md)。
- briefまたは完成画像をlocal保存する時は[`references/image-production-contract.md`](references/image-production-contract.md)。
- 利用者workspaceの`STUDIO.md`、`workspace.json`と、対象記事revisionのJSON metadata。
- `strategy/role-task-plan.md`と`profile/standing-instructions.md`。今回のbriefを継続指示より優先する。

## 1. 開始条件を確認する

見出し画像は、`note-writer`が保存した記事metadataの状態が`ready_for_image`で、利用者が選んだ確定タイトルと画像briefのタイトルが一致する時だけ作る。タイトル番号だけ、未確定の候補、本文制作中の状態では始めない。

差し絵は、見出し画像の完成後、本文理解または情景把握に役立つ一案を利用者が希望した時だけ別の一件として作る。装飾目的だけなら追加しない。

## 2. 一方向のbriefを作る

記事固有性、読む理由、小表示での視認性、文字とvisualの一体感、品位、実現性から異なる三方向を内部比較し、最も強い一方向だけをbriefへ残す。候補一覧、採点、promptを利用者へ見せず、デザイン選択を求めない。

```bash
python3 scripts/prepare_image_brief.py \
  /absolute/path/to/user-workspace \
  --config /absolute/path/to/image-brief-input.json
```

画像生成が使えない場合も、選んだ一方向のbriefを`generation_unavailable`として保存または返す。API keyを求めず、生成済みと報告しない。完成済みの記事revisionはそのまま維持する。

## 3. 一枚だけ生成する

利用可能な組み込み画像生成を優先し、一回の呼び出しで一画像だけ生成する。見出し画像と差し絵を同時生成しない。利用者が参照画像を指定した場合だけ必要最小限の参照を含め、無関係な過去画像を自動使用しない。

`exact_copy`がある見出し画像では、指定文字、背景、主役、構図、タイポグラフィを同じ一回の生成へ含める。文字だけを後から画像編集、HTML、SVG、Canvas、描画script等で足さない。`exact_copy=null`なら生成画像へ文字を入れない。

- 見出し画像: 1280×670px。
- 差し絵: 1280×720px。

直接その寸法にならない場合は、元画像を残して中央基準のcover切り抜きと縮小だけを行う。`prepare_note_image.py`は文字追加や装飾合成には使わない。

```bash
python3 scripts/prepare_note_image.py SOURCE.png FINAL.png --width 1280 --height 670
```

## 4. 人の目で検査する

完成候補を実寸で表示し、記事との一致、人物・手指・物体・画面等の破綻、切れ、余計な文字、本文より強い約束がないことを確認する。

見出し画像は最終画像から320×168pxの確認用画像を作り、実際に小さく表示して、主役と意味の核を拡大や凝視なしで読めるか確認する。失敗候補や比較用previewは残さず、QA対象とhashが一致したpreviewだけを完成assetの検証用fileとして保存する。

見出し画像の最終fileは8-bit RGBまたはRGBAの非interlace PNGにする。`prepare_note_image.py`で最終PNGから320×168pxを作り、標準出力の`output_sha256`をQAの`preview_sha256`へ入れる。このbuilt-in PNG経路はPython標準ライブラリだけで動く。RGBAはalphaを事前乗算して補間し、透明境界の色にじみを避ける。宣言寸法を超える展開データ、過大な入力・寸法、壊れた圧縮streamは外部backendへ回さず停止する。JPEGや特殊PNGの寸法変換はPillow、ImageMagick、`sips`、`ffmpeg`のいずれかが利用できる場合だけ使い、利用不能ならPNGへ変換済みと装わずbriefまでで止める。

中心的な問題がある時だけ、直す要素を一つに絞って再生成を一度行う。二回の試行で通らない場合は未解決点を報告し、通過済みと装わず停止する。

## 5. 完成物だけを保存する

全QAを通過した画像だけを、brief、結果metadata、追記型画像registryとともに利用者workspaceの`assets/{article-id}/`へ保存する。元記事revisionや既存画像を上書きしない。

```bash
python3 scripts/save_image_asset.py \
  /absolute/path/to/user-workspace \
  --brief assets/article-example001/thumbnail-brief-r001.json \
  --image-file /absolute/path/to/final.png \
  --qa /absolute/path/to/image-qa.json
```

QA入力には、画像生成が完了した`generated_at`と、人が実物を確認し終えた`reviewed_at`を別々に記録する。記事保存後にbriefを作り、そのbriefの作成後に画像を生成する。`記事保存 <= brief作成 < generated_at < reviewed_at`でなければ保存しない。保存scriptの`--timestamp`は`save_image_asset.py`が完成assetを保存する`saved_at`であり、`reviewed_at <= saved_at`を満たす必要がある。

保存scriptは最終PNGから同じ決定的処理でpreviewを再生成し、目視確認した`preview_sha256`との一致を確認して、完成画像に結び付いたpreviewも保存する。保存後は`validate_image_assets.py`を実行する。差し絵ではQAの`preview_sha256`を`null`とし、briefへ挿入位置、QAへキャプションと80字以内のALTを含める。見出し画像にはキャプションとALTを付けない。

## 利用者へ返すもの

見出し画像は、通過した完成画像一枚と、保存できた場合だけ保存先を記事制作タスクへ返す。制作手段、内部比較、採点、prompt、QA表は付けない。利用者に「記事制作タスクへ戻ってください」と手作業だけを委ねず、利用可能なtask coordinationで完了報告を返す。coordinationが使えない環境でもasset registryを完了receiptとし、記事制作タスクが再開できるpathを明示する。

差し絵は完成画像一枚に加え、挿入位置、キャプション、ALT、保存できた場合だけ保存先を返す。

画像生成または保存が失敗した時は、維持できた記事とbrief、未完了の画像工程、再開に必要な一手だけを短く伝える。

## 完了条件

- 確定タイトル後に開始している。
- 一件のbriefから一画像だけを扱っている。
- 記事全文やprivateな背景を画像工程へ渡していない。
- 目標寸法と実寸が一致している。
- 見出し画像は320×168pxの実表示を含め、人の目で確認している。
- 見出し画像にcopyがある場合、visualと文字を同じ画像生成で完成させ、後載せ合成していない。
- 未解決の誤字、破綻、切れ、記事との不一致がない。
- 記事保存より後に生成し、生成より後にQAし、QA以後にassetを保存している。
- local保存時はbrief、画像、metadata、registryのvalidatorがpassしている。
- 標準運用では対象記事、asset revision、image path、preview pathを記事制作タスクへ返している。
- 記事、note、公開、SNS、クラウド、永続タスクを変更していない。
