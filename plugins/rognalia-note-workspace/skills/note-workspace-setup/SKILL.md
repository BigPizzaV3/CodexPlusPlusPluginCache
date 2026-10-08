---
name: note-workspace-setup
description: note Workspaceの導入支援として、初回ヒアリング、運用提案、利用者所有のローカルworkspace作成、通常運用への引き継ぎを行う。noteを継続運用する環境を新しく整えたい時、保存先や投稿頻度を見直したい時、移行や修復を行う時に使う。通常の記事制作やメモ保存だけには使わない。
---

# note Workspaceを初期設定する

利用者が続けられるnote運用と、本人の一次情報を安全に残せる作業場所を整える。質問へ答えた瞬間に作成を始めず、目的、運用、保存先、作成対象を一つの提案にして確認してから書き込む。

## 最初に読むもの

- 提案を作る前に[セットアップ契約](references/setup-contract.md)を読む。
- workspaceへ書き込む前に[workspace契約](references/workspace-contract.md)を読む。
- 利用者向けタスクを作成、再利用、修復する前に[役割別タスクのオーケストレーション契約](references/task-orchestration-contract.md)を読む。
- Pluginとして使う場合は、[Plugin実行手順](../../adapters/openai-plugin/README.md)から導入状態、同梱Skill、継続先を確認する。

## 適用範囲

このSkillが担当するのは、初回セットアップ、設定変更、移行、修復である。標準構成ではセットアップを行った利用者向けタスクが戦略・編集方針担当を引き継ぎ、記事制作、計測、画像制作、日記・体験ログはそれぞれのタスクが担う。利用者が望む場合は1タスク簡易運用も選べる。

- noteの目的、優先順位、読者、テーマ、公開範囲、継続条件を整理する。
- 利用者が所有するworkspaceと初期ファイルを作る。
- host共通の`STUDIO.md`とhost adapterを作り、自然な会話で使う通常運用へ引き継ぐ。
- 標準5タスクまたは1タスク簡易運用を選び、名前、責任、開始指示、ready確認、受け渡しを整理する。
- 定期実行やクラウド同期は希望を記録できるが、対応Skillとadapterが揃い、対象を再確認するまで作らない。

一記事の調査、取材、執筆、画像制作、note下書き登録はこのSkillで実行しない。セットアップ後に利用者が「今日はこれを書きたい」と依頼した場合は、初回質問をやり直さず、`STUDIO.md`に従う記事制作タスクへ引き継ぐ。記事原稿を利用者へ返す直前には`note-draft-quality`を内部で使い、品質結果を付けず納品原稿だけを返す。単発記事だけを作りたい利用者には、環境を限定せず、対応環境で`note Studio mini｜ROGNALIA`または記事制作Skillを案内する。

## セットアップ開始時に期待値を伝える

最初の質問をする前に、長い説明書を読ませず、次を短く伝える。

- note Workspaceは、一記事だけでなく今後のnote運用を支える自分専用の編集部を作るためのものである。
- 最初だけ、目的、テーマ、文体、続け方、保存先等を数回に分けて質問する。
- 利用者が行う中心作業は質問へ答え、最後の提案を確認することであり、承認後のworkspace作成と担当taskの準備はAIが行う。
- 一記事をすぐ作れれば十分な場合は、環境を限定せず`note Studio mini｜ROGNALIA`も選べる。

質問数を謝罪したり、全質問を先に列挙したりしない。何を作るための質問かと、回答後に受け取れる状態を示してから、最初の一まとまりへ進む。

## 1. 既存状態を確認する

Pluginの開始文またはGitHub URLからのinstall依頼を引き継いだ場合は、利用者に開始commandやSkill IDを聞かず、そのままセットアップへ進む。会話ですでに分かっていることは聞き直さない。利用者が既存workspaceを示した場合は、新規作成と決めつけず、読み取り可能なら同梱のvalidatorで状態を確認し、正常なら`STUDIO.md`から依頼された通常運用へ進む。Pluginの導入だけを、workspaceやタスクの作成承認にしない。

- miniを使ったことがあるか、既存のnote、下書き、メモ、音声、文体設定があるかを確認する。
- 既存資産は、利用者が望むまで移動や複製をせず、参照、移行、使わないを分ける。

- 新規作成先は利用者が確認できる絶対パスで確定する。
- source repository内、Plugin cache内、別利用者の場所には作らない。
- 同名のfileまたはfolderが存在する場合は上書きしない。既存workspaceの修復や移行は、新規作成と分けて対象を確認する。
- 利用者のID、password、Cookie、認証code、API keyを受け取らない。

## 2. 足りない情報を段階的に聞く

質問数を機械的に固定しない。意味の近いまとまりを一つずつ扱い、一度に全項目を並べない。最低限、次を確認する。

1. 現在のnote運用、既存資産、miniの利用、止まりやすい工程。
2. noteで達成したいことと、半年後の成功の形。
3. 中心テーマ、避けたいテーマ、読んでほしい人、公開できる範囲。
4. 使える時間、希望頻度、最低限続けられる頻度、残しやすい入力方法。
5. 必要な制作工程と追加module。文章や画像の好みは、該当moduleを使う人だけ確認する。
6. 保存先、主な実行環境、標準5タスクまたは1タスク簡易運用、下書き登録、計測、週間企画、定期実行の曜日と時刻。

各まとまりの回答後に、利用者向けの普通の言葉で「決定済み」「要確認」「あとで決める」を短く返す。この途中経過を承認済み設定とは扱わず、workspaceへ書き始めない。

task modeを聞く時は名前だけを選ばせない。標準5タスクは、日々の話を日記担当へ、記事を書く時は記事制作へ話しかけ、ほかの担当も同じworkspaceから材料を参照する構成と説明する。日記担当での会話は原文を話者別に保存し、保存しない話は指定できること、記事への使用は別に公開範囲を確認することも提案に含める。1タスク簡易運用では一つの会話で同じ役割を切り替える。情報コピーは不要で、後から構成変更できる。

利用者の公開済み記事やプロフィールを調べる場合は、本人が確認を許可した公開情報だけを使う。人気の型を複製せず、本人の材料が差になる場所と無理なく続く条件を探す。

## 3. 書き込む前に一つの提案を出す

[セットアップ契約](references/setup-contract.md)の形式で、次を一度に示す。

- 目的と優先順位。
- 想定読者と中心テーマ。
- 投稿頻度と一次情報の残し方。
- 役割別タスクの名前と責任。
- 各タスクが最初に返す案内と、同じworkspaceを参照する確認方法。
- workspaceの絶対パスと作成する主要file。
- 下書き登録、計測、週間企画、定期実行、クラウド同期の扱い。
- 最初の一週間の行動。
- 今回実際に作成するものと、まだ作成しないもの。

利用者は全体承認、項目修正、一部保留を選べる。承認前にworkspace、タスク、定期実行、クラウド接続を作らない。

## 4. 承認済みworkspaceを作る

local fileへ書ける場合は、承認内容からsetup configを作る。configは公開repository、Plugin cache、Skill install先へ保存しない。利用者所有の場所または一時領域だけで扱う。同梱scriptは、この`SKILL.md`があるfolderを基準に解決する。

最初にdry-runを行う。

```bash
python3 scripts/create_workspace.py ABSOLUTE_DESTINATION --config SETUP_CONFIG.json --dry-run --workspace-id WORKSPACE_ID
```

dry-runの対象pathと作成予定fileが承認内容と一致した場合だけ、本作成を行う。親folderも新規作成する必要があり、その親folderまで承認されている時だけ`--create-parents`を付ける。

```bash
python3 scripts/create_workspace.py ABSOLUTE_DESTINATION --config SETUP_CONFIG.json --workspace-id WORKSPACE_ID
python3 scripts/validate_workspace.py ABSOLUTE_DESTINATION
```

`WORKSPACE_ID`はdry-runで使った値を本作成でもそのまま使う。dry-runと本作成の間でconfig、destination、workspace IDのいずれかが変わった場合は、変わった対象を確認してdry-runをやり直す。

scriptが拒否したpathを迂回して直接fileを上書きしない。作成に失敗した場合は、既に作った別のworkspaceを代わりに使わず、維持できた状態と次の一手を一つ返す。

## 5. 役割別タスクをセットアップする

workspaceの作成と検証が成功した後だけ、承認済みの役割別タスクを扱う。

- 新規の標準は`standard_five`で、`strategy`、`tracker`、`writer`、`image`、`diary`の5つの利用者向けタスクである。希望がある時は`compact`一つへまとめる。既存の`standard_four`は引き続き読めるが、日記担当を作成済みと扱わない。
- 標準5タスクでは、現在のセットアップタスクを`strategy`へtitle変更して再利用するのを既定とする。adapterは新しい役割タスクを作る前に現在タスク自身のtitle変更を試し、公式host read-backで実task ID、host ID、titleを確認する。確認できた時だけ`binding_origin: reused_setup`として扱い、新規作成するのは`tracker`、`writer`、`image`、`diary`の4タスクにする。
- title変更能力がない、現在タスクを同じworkspaceで継続できない、または変更後の公式read-backを取得できない場合は、役割タスクの作成前に停止して理由を伝える。別の`strategy`を黙って作らず、セットアップタスクを残す構成への変更を利用者が明示的に承認した場合だけ新規作成へ進む。title変更後にready確認を同じturnで完了できない時は、同じタスクの次turnで再開し、重複strategyを作らない。
- 公式のタスク作成能力がある時は、再利用しない承認済みroleだけを、承認済みtitle、同じworkspace path、`strategy/role-task-plan.md`の開始指示で作る。hidden subtaskではなく、利用者が開けるtaskを使う。Codex固有の現在タスク再利用手順はadapterに従う。
- 実際のtask IDとhost IDを得たら`prepare_role_task_kickoff.py`で現在generation専用の予測不能な一回限りnonceと開始指示を作る。challengeはworkspace内へ`issued`状態で保存される。各タスクへ出力された開始指示をそのまま送り、hostの公式task読取機能から開始messageとready返答を読み戻す。
- hostから読み戻したtask、message、時刻を`verify_role_task_readback.py`へ渡す。専用scriptがtask ID、host ID、title、開始文全文、workspace、role、継続指示revision、nonce、返答順序を照合し、challengeを`verified`へ進めた時だけbinding configを発行する。手作りのreceiptや任意のhashをbinding入力にしない。
- verifierが出したbinding configだけを`record_role_task_binding.py`へ渡す。記録成功時にchallengeを`consumed`へ進め、別bindingへの再利用を拒否する。最後に`validate_role_task_bindings.py --require-ready`を実行する。host read-back自体の取得はadapterの責任であり、local validatorだけでtaskの実在確認を代替しない。
- 対応能力がない環境では、偽のtask IDを記録せず、同じtitleと開始指示を利用者へ返す。SDKや新規dependencyを必須にしない。
- 画像は通常一つのtaskを再利用する。同時制作や長期化で追加taskが必要な場合だけ、利用者に理由と対象を示して承認を得る。
- 定期実行はtrackerをstrategyより先に動かす。対応Skillが実装済みで、曜日、時刻、実行場所、書き込み先、対象taskを再確認した時だけ作る。作成、変更、再実行、状態報告、重複判定の前にhostから現在のautomation ID、対象task、schedule、次回実行を読み戻す。読み戻せない時は`未確認`とし、作成済みとも未作成とも断定せず、重複作成しない。作成後も同じ項目を読み戻し、trackerが先であることを確認する。localの`automation_preferences`は希望の記録であり、現在状態の証拠にしない。

タスク、定期実行、クラウド同期の作成はlocal workspace作成とは別の外部状態である。実行していない操作を完了報告へ混ぜない。

## 6. 通常運用へ引き継ぐ

workspace validatorがpassし、承認済みのtaskを作成した場合はbinding validatorもpassしたら、`workspace.json`と`strategy/operating-settings.json`で通常運用のphaseが`operation`、runtime guideが`STUDIO.md`であることを確認する。生成済みの`START_HERE.md`を読み、その利用者のtask名と選択済み機能に合う「30秒で分かる使い方」を完了報告の本文にも出す。fileへのlinkだけを渡して終えない。

標準5タスクでは、日々の話や「何か質問して」は日記task、記事を書く時は記事制作task、方針相談は戦略taskが入口であると伝える。計測taskと画像taskは通常自分で開かなくてよく、全taskが同じworkspaceを読むため情報コピーは不要である。1タスク簡易運用では、その一つへ記事、企画、日記を自然に頼めると伝える。定期実行や役割taskを実際には作成していない場合、希望の記録と作成済みを混同しない。定期実行の現在状態をhostから読み戻せない場合は`未確認`と伝える。

既存の4タスクから5タスクへの変更は、日記の保存範囲、新しいタスク名、設定・ガイドの変更を提案し、承認後だけ行う。既存ログとtask IDを維持し、`binding_generation`を1増やす。同じ4タスクを再利用して新しい開始指示とreadyを照合し、追加作成するのは日記taskだけとする。既存bindingを新generationのreadyに流用しない。Plugin更新だけで利用者workspaceを移行しない。

最初の行動は利用者の目的に合わせて一つだけ始める。「メモを残したい」は一次情報ログ、「今日はこれを書きたい」は記事制作、「次に何を書くか考えたい」は企画へつなぐ。必要な役割Skillがない場合は実行済みと装わず、現在できる範囲と次の一手を返す。

テーマ、読者、公開範囲、保存先、機能構成等の構造的設定変更、移行、validator異常の修復を除き、通常運用からこのSkillへ戻さない。目標、希望頻度、最低限の頻度、継続・休止状態の見直しは、通常運用の`note-strategist`へ引き継ぐ。

利用者が「今後も」「毎回」等で複数taskに共通する指示を明示した場合は、記事一件の指定、文体、戦略変更と分ける。保存する現在一覧を短くread-backし、その更新への承認後だけ次を使う。

```bash
python3 scripts/update_standing_instructions.py WORKSPACE --config APPROVED_INSTRUCTIONS.json
python3 scripts/validate_standing_instructions.py WORKSPACE
```

入力は現在の全指示を持つため、既存指示を外す時も削除対象をread-backする。別taskの会話だけを根拠に暗黙追加せず、記事固有の指定を永続化しない。

## 完了条件

- 利用者が目的、頻度、テーマ、公開範囲、保存先を確認している。
- 作成対象と保留対象が分かれ、承認済みのものだけが作られている。
- workspace validatorがpassし、利用者が場所を見つけられる。
- 利用者が`START_HERE.md`と完了報告の30秒案内から、普段話しかけるtaskと最初の一言を判断できる。
- workspaceが`operation` phaseになり、`STUDIO.md`とhost adapterから役割分担または1タスク簡易運用を開始できる。
- 選択された役割別タスクは、対応能力がある環境では全taskがreadyを返しbinding validatorがpassしている。未対応環境では未作成と開始指示が明示されている。
- 定期実行とクラウド同期は、hostから確認できた実際の状態と`未確認`を分けて報告している。
- 次の行動が、一次情報を一件残す、既存資産を一件整理する、週間方針を作る、記事制作へ引き継ぐ、のいずれかに決まっている。

## 停止条件

次の場合は該当工程を止め、必要な次の一手を一つ返す。

- 保存先の絶対パスまたは所有者を確認できない。
- source repository内、Plugin cache内、既存の別用途folderしか指定されていない。
- 作成対象への明示承認がない。
- setup configがschemaを満たさない。
- 認証情報、権限不明資料、第三者の秘密を保存する必要がある。
- local fileへ書けないのに、workspaceを作成済みとして報告する必要がある。

fileへ書けない環境では、承認済み提案とsetup configのコピー用内容を返し、作成済みとは報告しない。
