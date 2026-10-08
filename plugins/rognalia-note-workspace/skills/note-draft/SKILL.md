---
name: note-draft
description: note Workspaceで完成・確認済みの記事、見出し画像、任意の差し絵、URLを、記事ごとの明示承認後だけ操作可能なブラウザでnoteの新規下書き一件へ登録し、非公開保存を確認して閉じる。公開、予約投稿、既存下書きの上書きには使わない。
---

# note Workspace 新規下書き登録

## 役割

完成済みの記事一件を、承認時点の内容へ固定してnoteの新規下書きへ登録する。noteは入力中にも外部へ保存され得るため、最初の文字入力から外部書き込みとして扱う。

ゴールは、新規下書き一件へ確定タイトル、本文末尾のnoteタグを含む本文、見出し、見出し画像、希望済みの差し絵、指定済みURLを登録し、非公開の下書きとして保存してエディターを閉じることまでである。公開設定へ進まない。

## 必ず読むもの

- 利用者workspaceの`STUDIO.md`、`workspace.json`、`strategy/operating-settings.json`。
- 登録packageを準備・記録する時は[`references/draft-registration-contract.md`](references/draft-registration-contract.md)。
- ブラウザで入力する時は[`references/note-editor-workflow.md`](references/note-editor-workflow.md)。
- 現在のhostにadapterがある場合は、そのbrowser能力と低下経路。

## 1. 完成物を事前確認する

次を揃え、利用者が見られる状態にする。

- `note-writer`で品質確認・保存済みの確定タイトルと本文。本文末尾にnoteタグ5個または6個が一行であること。
- `note-image`でQA・保存済みの見出し画像一枚。
- 差し絵がある場合は、QA済み画像、正確な挿入位置、ALT、任意のcaption。
- 本文内URLと、追加URLがある場合は正確な挿入位置。
- 現在の環境でnoteを操作できるbrowser能力。未ログイン時に、利用者自身の手動ログインを待てること。

足りないものを推測で補わない。見出し画像がない、差し絵位置が曖昧、URLが不明、記事や画像のvalidatorが通らない場合は、外部書き込みを始めず一項目だけ戻す。ID、password、Cookie、認証codeを尋ねたり保存したりしない。

利用者が現在の記事について「下書き登録は不要」と明示した場合は停止する。同じ制作経路でbrowserを開いたり、登録をもう一度勧めたりしない。

完成物を提示する直前に、記事revision、画像、挿入位置、URLを`prepare_draft_delivery.py`で読み取り、最新記事revisionであることと全hashを確認する。差し絵と追加URLの挿入先は、指定見出しと直後の本文anchorが記事内の同じsectionにそれぞれ一度だけ存在する必要がある。scriptの`delivery_sha256`と一致する記事・画像・URLをまとめて利用者へ見せる。

```bash
python3 scripts/prepare_draft_delivery.py \
  /absolute/path/to/user-workspace \
  --config /absolute/path/to/draft-delivery.json
```

## 2. 一度だけ承認を確認する

完成したタイトル、本文、タグ、画像、URLを利用者が確認した後に、次を一度だけ尋ねる。

> noteの下書き登録まで進めますか？ 公開はしません。

利用者が現在表示されている完成物を指して、新規下書きへ登録、入力、保存するよう明示的に依頼した場合も、その一件への承認として扱える。

承認は、新規下書き一件、承認時点の確定タイトル、本文末尾タグを含む本文、見出し画像、指定済み差し絵、本文内URL、指定済み追加URL、保存して閉じることにだけ結び付ける。承認時刻は記事保存と全画像のQA完了より後で、承認configの`delivery_sha256`は直前に提示した完成物receiptと一致させる。Skillの切り替え、browser起動、ログイン確認、手動ログイン完了だけを理由に取り直さない。

承認後にタイトル、本文、タグ、画像、URL、対象下書きが変わった時だけ、同じ文で取り直す。別の記事、複数記事、公開、予約投稿、既存下書きの更新へ承認を広げない。

## 3. 承認済み登録packageを作る

承認後、`prepare_note_draft_registration.py`で最新の記事revision、QA済み画像、URL、delivery hash、承認scopeを一つの追記型packageへ固定する。scriptのJSON結果は内部確認用であり、利用者へ貼り付けない。

```bash
python3 scripts/prepare_note_draft_registration.py \
  /absolute/path/to/user-workspace \
  --config /absolute/path/to/note-draft-registration.json
```

保存後に`validate_note_drafts.py`を実行する。package作成はlocal記録だけであり、noteへ書き込まない。browser能力がなければpackageと完成物を保ち、操作可能な環境で再開する。

## 4. 新規下書き一件へ登録する

承認後に現在利用できる安全なbrowser操作面を一つ選ぶ。同じ下書きの途中で複数の操作面を混ぜない。新規テキスト記事であることを画面上で確認し、既存下書きが表示されていたら入力しない。

最初の文字入力の直前に、packageと参照fileが変わっていないことをvalidatorで再確認し、`start_note_draft_registration.py`で外部書き込み開始をlocalへ記録する。

```bash
python3 scripts/start_note_draft_registration.py \
  /absolute/path/to/user-workspace \
  --registration articles/note-drafts/article-example001-registration-r001.json
```

同じpackageがすでに`external_write_started`で、保存済み結果がない場合は、新しい下書きを作らない。note側に途中保存がないか確認し、対象を安全に特定できない時は状態不明として停止する。

登録操作は[`references/note-editor-workflow.md`](references/note-editor-workflow.md)に従う。公開設定画面へ進まず、保存状態と非公開下書きを確認してエディターを閉じる。

## 5. 成功した時だけ結果を記録する

表示タイトル、本文の冒頭と末尾、見出し数、本文末尾タグ、画像、URL、保存完了、エディターを閉じたこと、非公開状態をすべて確認できた時だけ、`record_note_draft_result.py`で結果を追記する。

```bash
python3 scripts/record_note_draft_result.py \
  /absolute/path/to/user-workspace \
  --config /absolute/path/to/note-draft-result.json
```

確認できない項目、UI変更、画像失敗、URL消失、保存状態不明がある時は成功記録を作らない。開始記録後の状態が不明なら自動再試行せず、対象下書きの照合を次の一手にする。

## 利用者へ返すもの

成功時は、新規下書きを保存して閉じたこと、下書きURL、登録できなかった項目があればその一項目、公開していないことだけを短く返す。内部package、hash、検証表は付けない。

失敗時は、完成済みの記事と画像を維持し、note側で確認できた最後の状態と、安全に再開する一手だけを返す。

## 禁止

- 既存下書き、公開記事の上書き、削除、差し替え。
- 公開、予約投稿、公開設定への遷移または確定。
- 複数記事の一括登録。
- 承認前のbrowser起動、ログイン確認、文字入力、画像upload。
- ログイン情報の受領、保存、再利用。
- 見出し、URL、差し絵、挿入位置、ALT、captionの推測。
- 保存・非公開・エディター終了を確認せず、登録済みと報告すること。
- 開始後の状態が不明なまま、新規下書きをもう一件作ること。

## 完了条件

- 現在の最新記事revisionとQA済み画像をまとめて提示した後、その`delivery_sha256`に結び付く一度の明示承認がある。
- 各画像が`記事保存 < 画像生成 < 目視QA <= asset保存 < 利用者承認`の順序を満たす。同時刻のasset保存と承認は受け付けない。
- 記事revision、QA済み画像、URL、承認scopeをhashで固定している。
- 新規テキスト記事一件だけを扱っている。
- 見出し、本文末尾タグ、画像、URLが承認済み内容と一致する。
- 保存済み、非公開、エディター終了を確認している。
- localの結果記録とvalidatorがpassしている。
- 公開、予約投稿、既存下書き上書き、SNS投稿を行っていない。
