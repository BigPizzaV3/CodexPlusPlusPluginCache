# 一次情報のデータ契約

## 三つの層

1. 生ログ: 利用者の原文と任意の追加回答を追記する。
2. 一次情報カード: 後で検索できる小さな材料へ整理し、元ログIDを保持する。
3. 記事別文脈パック: 一記事に関係する最新カードだけを公開範囲別にまとめる。

要約やカードが変わっても、生ログを書き換えない。記事からcard ID、log IDを通って原文へ戻れる状態を保つ。

## 生ログrecord

schemaは[`schemas/raw-log-record.schema.json`](schemas/raw-log-record.schema.json)で定義する。

```json
{
  "schema_version": 1,
  "log_id": "log-20260823-a1b2c3d4",
  "request_id": "req-synthetic-0001",
  "recorded_at": "2026-08-23T20:00:00+09:00",
  "input_type": "text",
  "original_text": "利用者が入力した原文",
  "parent_log_id": null,
  "follow_up_question": null,
  "visibility": "confirm_before_use",
  "status": "active",
  "content_sha256": "64文字のhash",
  "payload_sha256": "64文字のhash"
}
```

- `original_text`は受け取った文字列を保持し、strip、要約、表記統一をしない。
- `request_id`は同じ実行の再試行を識別する。別の入力へ使い回さない。
- 追加回答は新しい`log_id`を持ち、`parent_log_id`で元入力へつなぐ。
- `visibility`は`private`、`confirm_before_use`、`public`のいずれか。
- hashは重複と破損の検査用であり、公開範囲の承認には使わない。

### 日記の会話record（version 2）

会話では`schema_version: 2`を使い、上の全fieldに`conversation_id`と`speaker`（`user`または`assistant`）を加える。同じschema fileがversion 1と2を検証する。旧recordを更新せず混在して読めるが、version 2の読取には対応版のSkillを使う。

- `parent_log_id`は同じ会話の先に保存した発言だけを参照できる。最初の発言ではnull。
- 質問と返答を別recordにするため`follow_up_question`はnull。
- AI発言は`input_type: text`、`visibility: private`。本人の発言は既存の入力種別と公開範囲を使う。
- 内容のhashに会話IDと話者を含め、再試行で話者や会話を変更できない。
- 旧version 1は本人の原文として読む。AI発言のlog IDはカードの`source_log_ids`へ指定できない。
- `read_source_logs.py`は通常は本人の原文だけを検索し、会話IDを指定した時だけ両話者を返す。原文を変更しない。

## 一次情報カードevent

入力configは[`schemas/source-card-input.schema.json`](schemas/source-card-input.schema.json)、追記recordは[`schemas/source-card-event.schema.json`](schemas/source-card-event.schema.json)で定義する。

カード更新は`cards.jsonl`へrevisionを追記する。同じ`source_card_id`で最大revisionのrecordが現在値である。

- `kind`: `event`、`observation`、`emotion`、`decision`、`quote`、`change`、`question`、`other`。
- `statement_type`: `fact`、`experience`、`inference`、`unknown`。
- `public_scope`: `private`、`confirm_before_use`、`public`。
- `source_log_ids`: 一つ以上の実在するlog ID。
- `exact_words`: 元ログ内に完全一致する時だけ設定する。
- `summary`: 検索用の短い整理。原文の代替ではない。

`public`は、利用者がその材料を一般利用できると明示した場合だけ使う。記事一件だけの承認はcard自体を`public`へ変えず、文脈パックの`approved_for_article`へ記録する。

文脈パックの作成eventは[`schemas/context-pack-event.schema.json`](schemas/context-pack-event.schema.json)に従い、`context-packs/registry.jsonl`へ追記する。pack本体と別に、使用card revision、記事ごとの承認、pack全体のhashを保持する。

## appendとlock

生ログ、カード、文脈パックは一度に一processだけ変更する。複数laneを読む処理は、生ログ、カード、文脈パックの順でlockを取得する。scriptは対象laneへ小さなlock fileを作り、追記または新規作成、flush、fsync後にlockを外す。

lockが残っている場合は、別processが動いていないこととlockの対象を確認するまで削除しない。lockを迂回して別fileへ追記し、後から混ぜない。

## schemaの変更

schema versionを上げる時は、古いrecordをその場で無言に書き換えない。移行script、対象、backup、rollback、validatorを用意し、利用者のworkspaceへ実行する前に承認を得る。
