# desktop local note下書き登録adapter

## 役割

`note-draft`が作る承認済みregistration packageを、現在のデスクトップ環境で利用できるbrowser操作面へつなぐ。Coreの承認scope、開始記録、停止条件を変えず、noteの新規テキスト記事一件へ入力する。

## 能力確認

承認前にbrowserを開かない。完成物の事前検証では、現在の環境が次を満たせるかだけを確認する。

- noteの現在画面を読み、login状態、新規記事、保存状態、非公開状態を区別できる。
- title、本文、見出し書式、見出し画像、任意の差し絵、ALT、caption、URLを入力できる。
- local workspace内のQA済み画像fileを選べる。
- 利用者自身の手動loginを待てる。認証情報を会話へ渡させない。

能力が`unknown`なら`available`とみなさない。登録packageと完成物をlocalへ保ち、利用できるデスクトップ環境で再開する。

## 操作面の選択

現在の会話から安全に操作でき、login状態とlocal画像へのaccessを維持できるbrowser面を一つ選ぶ。利用者が今回のbrowserを指定した場合は、その指定が利用可能で安全なら優先する。

host固有のtool名や優先順位は、そのreleaseの公式機能と実状態で決める。Core Skill、生成workspace、保存schemaへ固定しない。別windowやtabを開く操作面へ切り替える時だけ、利用者へ一文知らせる。

同じ下書きの途中で複数の操作面を混ぜない。操作面を変更する必要が生じた場合は、途中保存の対象を特定してから再開する。

## 実行境界

1. 完成記事、画像、URLを検証する。
2. 利用者が完成物を確認した後、記事ごとの承認を得る。
3. `prepare_note_draft_registration.py`で承認packageを作る。
4. browserで新規記事であることを読み取り確認する。
5. 最初の文字入力直前にvalidatorと`start_note_draft_registration.py`を実行する。
6. `note-draft`のeditor workflowに従って一件だけ入力する。
7. 保存、非公開、editor終了を確認できた時だけ`record_note_draft_result.py`を実行する。

開始event後にbrowser状態が分からなくなった場合は、新しい下書きを作らない。note側の途中保存とregistration packageを照合する。

## 対象外

- 公開、予約投稿、公開設定の確定。
- 既存下書きまたは公開記事の更新、削除。
- 複数記事の一括登録。
- ID、password、Cookie、認証codeの取得または保存。
- browser操作を行う常駐service、SDK、dependencyの追加。
