# 役割別タスクのオーケストレーション契約

## 目的

セットアップで作成する利用者向けタスクを、空の会話ではなく、役割、同じworkspace、最初の案内、受け渡し先が分かる状態で引き渡す。タスクの会話履歴を運用の正本にはしない。

## 構成

新規の標準`standard_five`は次の5タスクである。

1. `strategy`: 初回セットアップを引き継ぐ戦略・編集方針。
2. `tracker`: 公開ログと指標の記録。
3. `writer`: 記事制作の利用者窓口。画像を受け取り、納品後の下書き確認まで保持する。
4. `image`: 記事ごとの画像制作とQA。通常は同じタスクを再利用する。
5. `diary`: 日記・体験ログ。質問から始める会話、原文保存、本人の材料整理。

`compact_single`では`compact`一つが5役を切り替える。`standard_four`は従来の4役として読める。一次情報ログはどの構成でも共有Skillとして使えるが、新規の標準では専用の日記担当を作る。

## 作成順序

1. local workspaceを作成し、workspace validatorを通す。
2. 利用者が承認した`task_topology.mode`、task title、workspace pathをread-backする。
3. 標準構成では、現在のセットアップタスクを`strategy`として再利用するのを既定とし、新しい役割タスクを作る前に現在タスク自身のtitleを変更する。1タスク簡易運用では同じ方法で現在タスクを`compact`として再利用する。
4. title変更後、公式host read-backで現在タスクの実task ID、host ID、title、同じ会話の継続を確認する。新規の標準構成で作るのは`tracker`、`writer`、`image`、`diary`の4タスクであり、別の`strategy`を作らない。
5. 実際のtask ID、host ID、title、role、現在の`binding_generation`から`prepare_role_task_kickoff.py`で予測不能な一回限りのready nonceと開始指示を作る。scriptはnonceを含むchallengeをworkspaceへ`issued`状態で保存する。
6. 出力された開始指示を値を変えずに送り、hostの公式task読取機能で、同じtaskの開始messageとready返答を読み戻す。read-back JSONはadapterがhostの返値から作り、利用者や別の推論工程がmessage ID、本文hash、時刻を手入力しない。
7. `verify_role_task_readback.py`へnonceとread-back JSONを渡す。task ID、host ID、title、開始文全文、workspace IDと絶対path、role、継続指示revision、nonce、message順序と時刻が一致した時だけchallengeを`verified`へ進め、[`role-task-binding-input.schema.json`](schemas/role-task-binding-input.schema.json)に合うbinding configを発行する。
8. verifierが発行したbinding configだけを`record_role_task_binding.py`で記録する。記録成功時にchallengeを`consumed`へ進め、同じproofを別bindingへ再利用できなくする。
9. `validate_role_task_bindings.py --require-ready`を通してからセットアップ完了と報告する。

title変更能力がない、現在タスクを同じworkspaceで継続できない、または変更後の公式read-backを取得できない場合は、役割タスクを作る前に停止する。利用者へ理由と、別のstrategy taskを作るとセットアップtaskが別に残ることを示し、その構成変更への明示承認を得るまで新規strategyを作らない。title変更後に現在タスクのready read-backを同じturnで完了できないhostでは、同じタスクの次turnへ引き継ぎ、別strategyによる代替や架空のread-backを行わない。

### Codexで現在タスクを再利用する

Codex adapterは、現在タスクのIDを推測してからtitle変更する必要はない。現在タスクを対象にできるtitle変更機能を使い、`threadId`を指定せず`🧭 note｜戦略・編集方針`へ変更する。変更結果または公式の現在task read-backから実task IDとhost IDを得て、titleと同じ会話が維持されたことを確認する。この確認前に`create_thread`でstrategyを作らない。

再利用したstrategyのchallengeは`--binding-origin reused_setup`で作る。現在タスクが実行中で開始指示とreadyの公式read-backを完了できない場合は、同じtaskのfollow-up turnで処理を続ける。`tracker`、`writer`、`image`、`diary`は利用者承認済みの場合だけ新規作成し、`--binding-origin created`を使う。diaryを含む5件のreadyが揃うまで標準5タスクの準備完了としない。

adapterがCLIへ接続する場合、verifierの`--binding-only`を使えばbinding configを手編集せずrecorderへ渡せる。`NONCE`はprepare結果、`HOST_READBACK.json`は直前の公式host読取結果から得る。read-backをsource repositoryや長期workspaceへ保存しない。

```bash
python3 scripts/verify_role_task_readback.py WORKSPACE \
  --nonce NONCE \
  --evidence HOST_READBACK.json \
  --request-id REQUEST_ID \
  --binding-only \
| python3 scripts/record_role_task_binding.py WORKSPACE --config -

python3 scripts/validate_role_task_bindings.py WORKSPACE --require-ready
```

shellで実行結果を判定する時はpipeの前段失敗も検出する設定を使う。host adapterがJSONをmemory内で受け渡せる場合は、一時fileを作らず同じ二段階を行ってよい。CLIへ渡す時は、`--evidence -`のUTF-8標準入力か、利用者が承認した一時領域のUTF-8 JSONを使う。日本語本文とWindows pathを別encodingへ変換せず、host固有のJavaScript `TextEncoder`やbase64機能を前提にしない。

task作成、title変更、message送信、heartbeat作成は外部状態である。local workspace作成の承認から推測せず、セットアップ提案で対象が承認されている時だけ行う。

## 開始指示

各開始指示には次を含める。

- 利用者が選んだworkspaceの絶対パス。
- 最初に`START_HERE.md`、`STUDIO.md`、`strategy/operating-settings.json`、`profile/standing-instructions.md`を読むこと。
- `strategy/role-task-plan.md`にある自分の役割、担当外、受け渡し先。
- 会話だけを正本にせず、永続情報を適切なworkspace fileへ保存すること。
- 利用者へ、自分が何を支えるか、普段そのtaskを自分で開く必要があるか、最初にどう話しかければよいかを一度だけ案内すること。

diaryは日々の話と質問の依頼、writerは執筆と迷った時、strategyは方針や次のテーマの窓口として案内する。trackerはplatformで定期実行の作成済み状態を確認できた場合は通常は自動、imageは通常writerから依頼される。全taskは同じworkspaceを参照し、手動の情報コピーを求めない。diaryの開始案内には会話の保存先、保存しない指定、記事使用の別確認を含め、ready返答自体を日記へ保存しない。`compact_single`では一つのtaskへ話しかければよいと案内する。

generator 0.3.0-devで作成済みのworkspaceは`START_HERE.md`を持たないため、移行前のtask kickoffでは存在しないfileを読ませず、`STUDIO.md`以下から開始する。新規workspaceの案内品質を旧workspaceへ暗黙書き込みする理由にしない。

準備完了の返答を得られない、hostからmessageを読み戻せない、開始文が一致しない、nonceが違う、異なるworkspaceを参照している、役割を誤認している場合はchallengeをverifiedにしない。verified challengeは一度だけbindingへ使う。local verifierは、adapterが渡したhost read-backとlocal challengeの連続性・整合性を検査するもので、任意JSONの発行者を暗号学的に認証したり、platform上のtaskを単独で照会したりはしない。live read-backはadapterの責任であり、自己申告、手作りのexport、架空のmessage IDで代用しない。hostが署名付き証拠を提供しない環境では、同じ実行権限を持つ悪意あるadapterによる証拠偽造は保証外とする。

## 記事と画像の受け渡し

- writerは、タイトル選択と記事revision検証の後だけ、imageへbounded briefを送る。
- imageは、asset registryへのrevision保存、実寸と小表示の目視QA、納品pathの返却まで担当する。
- writerは画像の完了を待ち、記事と画像を利用者へ提示した後だけ、下書き登録の確認を行う。
- image taskを起動した時点を納品完了にしない。imageが利用者へ直接「writerへ戻ってください」と委ねるだけの運用にしない。
- 同時制作や長期化で追加image taskが必要な時は、理由、title、対象記事を示して利用者の承認を得る。hidden subtaskは標準経路にしない。

## 定期実行

- tracker heartbeatを先に実行し、取得時刻、status、失敗をworkspaceへ記録する。
- strategy heartbeatは、その後に最新の計測状態を確認して`strategy_recommendation`を保存する。
- strategyの各週間revisionは、読んだ`metrics/history.jsonl`のprefix長、hash、確認時刻、直近runと項目別statusを`tracking_review`として固定する。後続計測の追記は過去receiptを壊さない。
- recommendationは利用者の確定判断ではない。writerは推奨候補を示せるが、利用者が別テーマを指定したら優先する。
- `operating-settings.json`の`automation_preferences`は利用者が希望したscheduleだけを保持し、heartbeatの現在状態をcacheしない。
- heartbeatを作成、変更、再実行、状態報告、重複判定する前に、platformから実際のautomation ID、対象task、schedule、次回実行を読み戻す。読み戻せない時は状態を`未確認`とし、作成済みとも未作成とも断定せず、新しいheartbeatを重ねて作らない。

## 修復と追加タスク

同じroleとslotを別taskへ結び直す時は、現在有効なbindingの`event_id`を`replaces_event_id`へ指定する。同じtaskを同じ構成内の別roleへ再利用する時も、そのtaskの現在有効なbindingを置換する。過去recordを削除または書き換えない。

`standard_five`、従来の`standard_four`、`compact_single`を切り替える時は、対象と保存範囲を確認し、承認後だけ`binding_generation`を1増やして全taskへ新しいnonce付き開始指示を送る。4から5へ変える場合は既存4taskを維持し、日記taskだけ追加する。再利用taskの新bindingでは直前の有効eventを`replaces_event_id`へ指定する。ガイドも現在構成へそろえる。元の構成へ戻しても古いgenerationのbindingは復活しない。generationを増やさずmodeだけ変える操作と巻き戻しはscriptが拒否する。

過去eventは記録時点の`task_mode`とtitleを保持する。現在のmodeでreadyと数えるのは、そのmodeに属し、現在のtitleと一致する有効bindingだけである。task modeまたはtask titleを変更した時は、対象taskへ新しい開始指示を送り、readyを再確認してから新しいbinding eventを追記する。設定fileの変更だけで過去bindingを現在のreadyとして流用しない。

一つのeventで、すでに埋まったslotと、別roleへ有効binding中のtaskの両方を同時に置換しない。必要な外部task状態と置換順を先に整理する。標準5タスク以外の追加image taskは`slot`を`extra-...`にし、それ以外のroleでは追加slotを作らない。
