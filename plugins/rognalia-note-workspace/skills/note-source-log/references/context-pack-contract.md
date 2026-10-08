# 文脈パック契約

## 目的

執筆担当へ生ログ全体を渡さず、一記事に必要な材料、公開範囲、足りない情報、元ログへの追跡を小さくまとめる。

入力は[`schemas/context-pack-input.schema.json`](schemas/context-pack-input.schema.json)に従う。

## 選択

- card IDは戦略担当、執筆担当、利用者が記事テーマとの関係を説明できるものだけを選ぶ。
- 同じcard IDの複数revisionがある場合は、validatorを通過した最新revisionだけを使う。
- archived cardは選ばない。
- `approved_for_article`は、利用者がその記事へ使うと明示したcard IDだけを含める。
- `missing_information`は、記事を成立させるためにまだ確認が必要な点を記録する。

## 出力区分

### 記事へ使用できる材料

- `public`のcard。
- `approved_for_article`に含まれるcard。

### 公開前確認が必要な材料

- `confirm_before_use`で、この記事への承認がまだないcard。

本文へ断定利用せず、必要なら最大3問の取材へつなぐ。

### 記事へ使用しない背景

- `private`で、この記事への承認がないcard。

記事方向の内部理解に必要な場合だけ残し、本文、タイトル、画像、告知文へ移さない。

## 出力file

`context-packs/{article_id}.md`へ新規作成し、`context-packs/registry.jsonl`へ一件の作成eventを追記する。各cardに次を含める。

- card IDとrevision。
- kindとstatement type。
- summaryと、存在する場合だけexact words。
- topic。
- 元ログID。
- cardの公開範囲。
- この記事での承認状態。

同じ`request_id`と同じ入力で再試行した場合だけ既存fileを重複として返す。異なる入力で同じ`article_id`を上書きしない。

先頭のmetadataは正規化済み入力、選択時点のcard revisionとevent hash、入力全体のhash、本文hashを持つ。registry eventは記事ID、request ID、相対path、記事ごとの承認、card revision、pack全体のhashを別fileへ固定する。validatorは、記録したrevisionが作成時点の最新有効版だったこと、本文の再構築結果、packとregistry eventの一致を確認する。作成日時を保ったままmetadata、本文、内部hash、registryを過去revisionへ戻した場合や、registryを変えずに承認cardを足して再計算した場合は停止する。cardが後で更新されても、このpackが使ったrevisionは変えない。新規packの作成日時が選択cardの更新日時より前なら、保存前に停止する。

pack本体の新規作成後、registry追記前に中断した場合は、同じrequest IDと同じ入力の再試行が既存packを再構築して照合し、不足するeventだけを追記する。内容が少しでも違う場合は回復とみなさず停止する。

## 信頼境界

このhashと別registryは、事故、部分的な書き換え、相互に整合しない差し替えを検出するためのlocal完全性検査である。pack、card履歴、registry、日時、すべてのhashを同じ権限で一貫して書き換えられる相手に対する改ざん証明ではない。その脅威まで扱う場合は、利用者workspaceの外に置く署名鍵、外部anchor、または別権限の監査記録を別設計として評価する。外部依存や秘密鍵管理を暗黙に追加しない。
