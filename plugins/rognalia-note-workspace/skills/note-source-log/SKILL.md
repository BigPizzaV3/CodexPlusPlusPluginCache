---
name: note-source-log
description: note Workspaceで日々の出来事や気持ちを聞き、質問から始まる日記の会話も原文のまま利用者のworkspaceへ残す。今日あったことを話したい、何か質問してほしい、メモを残したい、過去の記録を企画や記事に使いたい時に使う。記事本文の執筆や外部公開には使わない。
---

# 日記・体験ログを残す

話したいことを気軽に話せる場所にする。利用者の原文を先に保存し、質問を頼まれたら一つずつ聞く。入力のたびに記事化を迫らず、小さな出来事や感情を勝手に教訓へ変えない。

## 最初に読むもの

- 原文やカードへ書き込む前に[一次情報のデータ契約](references/data-contract.md)を読む。
- 日記担当として会話する時、質問から始める時、会話を再開する時は[日記の会話手順](references/diary-conversation.md)を読む。
- 記事別の材料を取り出す時だけ[文脈パック契約](references/context-pack-contract.md)を読む。

## 適用範囲

このSkillは次を担当する。

- 利用者の入力を日時付き、追記式で保存する。
- 同じ実行の再試行を重複登録しない。
- 原文を要約で置き換えず、追加回答を元入力へリンクする。
- 再利用できる場面、観察、感情、判断、発言、変化を一次情報カードへ整理する。
- 一記事に関係するカードだけを、公開範囲と元ログID付きで文脈パックへまとめる。

記事方向、構成、本文、画像、note下書き、公開は作らない。

## 1. workspaceと入力境界を確認する

利用者が選んだworkspaceの絶対パスを使い、`workspace.json`と`strategy/operating-settings.json`を確認する。source repository、Plugin cache、Skill install先、別利用者のworkspaceへ保存しない。

次を含む場合は、その部分を再掲して広げず停止する。

- ID、パスワード、Cookie、認証コード、APIキー。
- 利用者が処理権限を持たない第三者資料。
- AI利用を禁止された資料。
- 顧客や勤務先との契約上、外部AIへ渡せない情報。

新規の標準構成には`📔 note｜日記・体験ログ`（role: `diary`）がある。セットアップで保存先と会話保存を案内・承認済みの日記担当へ話しかけることは、その会話を同じworkspaceへ残す依頼として扱う。準備確認のメッセージは保存しない。他の担当や1task簡易運用でも日記・記録の依頼があれば同じSkillを使えるが、無関係な会話まで保存しない。従来の4task構成へタスクを無断追加せず、別の保存先やクラウドへの承認にも広げない。

「保存しないで」と言われた発言、その引用を含む返答、そこからのカードは書き込まない。「ここから保存しない」なら再開の明示まで保存を止める。既に保存した記録の削除は別の確認が必要であり、今後の保存停止と混同しない。ローカル保存でも会話自体は利用中のAIサービスで処理される。

## 2. 原文を先に追記する

日記の会話では[日記の会話手順](references/diary-conversation.md)の会話ID・話者付き保存を使う。以下は単発メモと従来形式の追加回答の保存方法である。

入力を整えたり要約したりしてから保存しない。同梱scriptへ、利用者の原文をUTF-8 fileまたはstdinで渡す。再試行時に同じ値を使える`request_id`を一件ごとに作る。

```bash
python3 scripts/append_log.py WORKSPACE --input-file INPUT.txt --input-type text --request-id REQUEST_ID
```

音声起こしは`voice_transcript`、日記は`diary`、箇条書きは`bullet_notes`を使える。入力方法が不明なら`text`にする。公開範囲を利用者が明示していない時は`confirm_before_use`を使う。

質問を一つ返す意味がある場合は、原文と同じrecordへ質問も保存できる。質問の生成や回答を待つことで原文保存を遅らせない。

```bash
python3 scripts/append_log.py WORKSPACE --input-file INPUT.txt --input-type text --request-id REQUEST_ID --follow-up-question-file QUESTION.txt
```

回答が後から届いた場合は、新しい追記recordとして保存し、元の`log_id`を`parent_log_id`へ指定する。過去recordを上書きしない。

```bash
python3 scripts/append_log.py WORKSPACE --input-file ANSWER.txt --input-type follow_up_answer --parent-log-id PARENT_LOG_ID --request-id REQUEST_ID
```

## 3. 必要な時だけ一つ質問する

記録だけの依頼では、原文を保存した後、話を理解するために必要な時だけ短い質問を一つ返す。「何か質問して」と頼まれた時は原文の出来事がまだなくても質問から始められる。一度に一問を目安に会話を続け、答えたくない質問は飛ばせる。質問のために原文保存を遅らせない。

- 見えたもの、聞いた言葉、起きた順序が曖昧な時。
- なぜ迷ったか、なぜ選んだかが重要な時。
- 前後の変化や、今も残る違和感が重要な時。

回答は任意であり、答えなくても保存完了とする。入力のたびに質問しない。記事化、結論、学び、読者価値を押し付けない。

## 4. 一次情報カードを作る

後で検索しやすくなる材料だけをカード化する。一つの入力から必要以上に分割せず、原則0〜3枚にする。

card configを[card schema](references/schemas/source-card-input.schema.json)に合わせ、利用者所有の場所または一時領域へ置く。`source_log_ids`は実在する元ログだけを指定する。

```bash
python3 scripts/upsert_card.py WORKSPACE --config CARD.json
```

- `kind`で出来事、観察、感情、判断、発言、変化、問いを分ける。
- `statement_type`で`fact`、`experience`、`inference`、`unknown`を分ける。
- 本人の正確な言葉を残す時だけ`exact_words`を使う。元ログに存在しない文は引用として保存しない。
- 公開範囲が未確認なら`confirm_before_use`、非公開なら`private`とする。`public`は利用者が一般利用を明示した時だけ使う。
- summaryは原文の代わりではない。解釈を事実として書かない。
- 会話からカードを作る時は、本人の`user`発言だけを`source_log_ids`に指定する。AIの質問、推測、共感の言い換えを本人の経験や引用として採用しない。旧version 1の原文は本人の入力として読める。

挨拶、質問の依頼、保存設定だけの発言を材料カードにしない。具体的な経験や考えが残った時に0〜3枚作り、記事に向くかで保存の価値を決めない。

同じカードを更新する時は同じ`source_card_id`を指定する。scriptは過去の版を書き換えず、新しいrevisionを追記する。

## 5. 記事別の文脈パックを作る

利用者、戦略担当、執筆担当が具体的な記事テーマを示した時だけ作る。生ログ全体を渡さず、関係する最新カードだけを選ぶ。

まず同じworkspaceの`source-cards/cards.jsonl`を参照する。カードにない記録を探す時や原文を確かめる時は`scripts/read_source_logs.py WORKSPACE --query KEYWORD --limit 10`または`--log-id LOG_ID`を使い、必要な範囲だけ読む。通常の検索は本人の発言だけを返す。関係する未整理の原文はカード化してから渡す。非公開背景や使用前確認の材料を、確認なしで記事本文へ使わない。

```bash
python3 scripts/build_context_pack.py WORKSPACE --config CONTEXT_PACK.json
```

- `public`またはこの記事で明示承認されたカードを「記事へ使用できる材料」へ置く。
- `confirm_before_use`は「公開前確認が必要な材料」へ分ける。
- `private`は「記事へ使用しない背景」へ分け、本文の事実として使わない。
- 各カードへ元ログIDを残す。
- 材料が足りない点は`missing_information`へ明記し、推測で埋めない。
- 同じ`article_id`の既存packを上書きしない。同じ`request_id`の再試行だけ重複として成功扱いにできる。
- packとは別に`context-packs/registry.jsonl`へ作成eventを追記し、記事ごとの承認、card revision、pack全体のhashを固定する。pack作成後にregistry追記で中断した再試行は、同一内容を確認してeventだけを回復する。

## 6. 検証して返す

追記、カード化、文脈パック作成後は同梱validatorを実行する。

```bash
python3 scripts/validate_source_data.py WORKSPACE
```

日記では自然な返答を中心にし、保存確認は短く添える。毎回IDや保存先を並べず、初回、利用者からの質問、保存失敗の時に必要な場所を案内する。単発の記録依頼では保存したものを短く返す。内部hash、lock、schema、script名は通常の返答へ出さない。保存が失敗したら未保存と伝え、同じrequest IDで再試行できる状態を保つ。カードや文脈パックを作らなかった場合は、作成済みと報告しない。

## 完了条件

- 原文が一度だけ追記され、元の文字列へ戻れる。
- 任意の追加回答が元ログIDへリンクしている。
- カードを作った場合、元ログID、statement type、公開範囲を持つ。
- 正確な引用は元ログ内に存在する。
- 文脈パックは作成時点の最新カードだけを含み、公開範囲を分け、packとregistry eventが一致している。
- validatorがpassしている。
- note、SNS、クラウド、別repositoryへ送信していない。

## 停止条件

- workspaceの正本または所有者を確認できない。
- 原文を保存する前に、要約だけで置き換える必要がある。
- 同じ`request_id`が異なる内容に使われている。
- 元ログにない言葉を正確な引用として保存する必要がある。
- 公開範囲が不明なカードを、確認なしで記事へ使用可能として扱う必要がある。
- 既存file、card revision、context packを無断で上書きする必要がある。
