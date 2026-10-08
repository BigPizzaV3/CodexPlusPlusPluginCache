# desktop local adapter

## 役割

`note-workspace-setup`、`note-source-log`、`note-strategist`、`note-writer`、`note-image`、`note-draft`、`note-style-profile`、`note-tracker`が決めた結果と、`note-draft-quality`の内部確認を、local fileを扱えるデスクトップ環境で実行するadapterです。Coreの質問、承認、保存境界を変えず、現在利用できるfile操作、画像機能、browser機能、タスク機能へ変換します。

workspace、履歴、検証、見出し画像PNGの切り抜き・縮小scriptはPython 3.9以上の標準ライブラリだけで動き、package installやinstall scriptは必要ありません。PNG経路はRGBAのalpha事前乗算、入力量・pixel数・展開量の上限も検証します。JPEGまたは特殊PNGの寸法変換だけはPillow、ImageMagick、macOSの`sips`、`ffmpeg`のいずれかを任意backendとして検出し、なければ対応PNGの再生成またはbriefまでへ低下します。壊れたPNGや安全上限超過は任意backendへ迂回しません。

## 対応する操作

- 利用者が確認した絶対パスへのlocal workspace作成。
- workspace scriptのdry-run、本作成、validator実行。
- 利用者向け`START_HERE.md`、AI向け`STUDIO.md`、Codex用`AGENTS.md`から、標準5タスクまたは1タスク簡易運用へ引き継ぐ。
- 現在の環境で公式のtask作成機能が使える場合の、利用者向けtask作成、開始指示、ready確認、binding receipt記録。
- タスクを自動作成できない場合の、標準名と開始方法の提示。
- 選択済みworkspaceへの原文追記、追加回答のリンク、一次情報カードの版管理。
- 記事別文脈パックの新規作成と、一次情報全体のlocal検証。
- strategy heartbeatの未確定推奨と、利用者選択を分けた週間revision保存。source card snapshotを含めてlocal検証する。
- 明示承認済みの目標、頻度、継続・休止状態の履歴付き変更。
- 一記事の材料確認、必要な調査、最大3問、構成とトーンの確認、本文、タイトル、タグ、X投稿文の制作。
- local原稿に対する、読み取り専用の文体signal確認。結果は内部で使い、通常の原稿へ付けない。
- タイトル選択後のdraft Markdown、metadata、記事台帳eventの追記型local保存と検証。
- 確定記事からの小さな画像brief、利用可能な組み込み画像生成、見出し画像の実寸と最終PNGから決定的に作る320×168px小表示の目視確認。
- 再利用する画像制作taskで、QAを通過した見出し画像と希望済みの差し絵、metadata、画像registryを追記型で保存・検証し、記事制作taskへ完了receiptを返す。
- 完成物への一度の承認を記事、QA済み画像、URLへ結ぶregistration package、外部入力開始event、非公開保存結果のlocal記録。
- 利用可能なbrowser能力がある場合の、新規下書き一件への入力、保存、非公開確認。詳細は[`note-draft adapter`](note-draft.md)で定める。
- 本人が権利を持つ文章から、元本文を保存しない文体プロフィール案の作成、承認後のcurrent＋追記型履歴保存。
- 公開note記事のread-only確認と、ダッシュボードのインプレッション、ページビュー、スキ、コメント、売上を、対象期間・記事またはアカウントのscope・集計時刻・取得元・status付きで記録。詳細は[`note-tracker adapter`](note-tracker.md)で定める。

## 対応しないこと

- Google Drive、Dropbox、private GitHub等への同期。
- scheduled taskの無承認作成。手動計測を通した後、対象と権限を示して別承認を得た場合だけhost機能へ接続する。
- note、Web、SNSへの公開。
- SDK、MCP server、databaseの追加。

画像生成能力がない場合は画像を完成済みとせず、一方向に絞ったbriefまでを残します。

## 保存先

現在の標準提案は`Documents/Note Workspace/note-workspace`です。macOS、Windows、同期folderの構成は環境ごとに異なるため、実際の絶対パスを表示して承認を受けます。scriptは曖昧な初期pathへ自動保存しません。

source repository、Plugin cache、Skill install先、既存project内は候補にしません。利用者が別の場所を指定した場合は、その場所の所有者と用途を確認して優先します。

## task作成

workspace作成後の標準入口は、次の5つの利用者向けtaskです。

- `🧭 note｜戦略・編集方針`
- `📊 note｜計測・公開ログ`
- `✍️ note｜記事制作`
- `🎨 note｜画像制作`
- `📔 note｜日記・体験ログ`

1. 対応するSkillと公式task作成能力を確認する。
2. task mode、task title、参照するworkspace絶対path、開始指示、外部操作を示す。
3. 標準5taskでは、利用者が承認したtitle変更を新規task作成より先に行い、現在のsetup task自身をstrategyへrenameする。公式read-backで同じtaskの実ID、host ID、titleを確認できた時だけ`reused_setup`として扱う。
4. 再利用確認後にtracker、writer、image、diaryの4taskだけを新規作成する。strategyを重複作成しない。renameまたはread-backを確認できない場合は新規task作成前に停止し、setup taskが別に残るfallbackへの明示承認を得る。
5. 実task IDとhost IDごとに`prepare_role_task_kickoff.py`を実行し、現在のbinding generationとランダムな一回限りnonceを含む開始指示を値を変えず送る。再利用したstrategyは`reused_setup`、新規4taskは`created`を指定する。
6. hostの公式task/message読取機能で開始指示とready返答を読み戻し、その返値からread-back JSONを作る。利用者やagentがmessage ID、本文hash、時刻を推測して埋めない。
7. host返値は`--evidence -`のUTF-8標準入力または承認済み一時JSONで`verify_role_task_readback.py`へ渡し、task ID、host ID、title、開始文全文、workspace、role、継続指示revision、nonce、message順序を照合する。日本語とWindows pathの受け渡しにhost固有のJavaScript base64機能を前提にしない。`--binding-only`の出力を手編集せず`record_role_task_binding.py --config -`へ渡し、一回限りchallengeを消費してから`validate_role_task_bindings.py --require-ready`を通す。
8. task作成またはread-back能力がない場合は偽のIDや証拠を記録せず、同じtitleと開始指示を返す。利用者が1タスク簡易運用を選んだ場合は`📝 note｜執筆サポーター`一つで同じ正本と品質契約を使う。

各開始指示は`START_HERE.md`を読み、担当内容、普段そのtaskを開く必要、最初の一言を案内させます。標準構成では日々の話はdiary、執筆はwriterを入口にし、trackerとimageを利用者が毎回開かなくてよい状態へします。完了報告には個別化された30秒案内を再掲します。

`note-draft-quality`のために独立taskを作らず、`note-writer`が記事原稿を返す工程から内部で使います。`note-image`は通常一つの利用者向けtaskを再利用し、記事制作taskへQA済みassetを返します。同時制作等で追加image taskが必要な場合だけ別承認を得ます。`note-draft`も独立taskを必須にせず、記事と画像の納品後の承認でbrowser能力へ接続します。`note-style-profile`は文体を見直す時だけ使い、記事ごとの指定を上書きしません。`note-tracker`をheartbeat化する場合はstrategyより先に動かし、定期実行は別承認後だけ作ります。localには希望scheduleだけを保存し、作成、変更、再実行、状態報告、重複判定の前後にhostからautomation ID、対象task、schedule、次回実行を読み戻します。読み戻せない時は`未確認`として重複作成を止めます。strategyの週間revisionは実際に読んだmetrics履歴prefixをhash付きで残します。頻度や休止を変更してもheartbeatは別の外部状態として自動変更しません。

## 失敗時

- local fileへ書けない場合は、承認済み提案とconfigを会話内へ返し、作成済みとは報告しません。
- destinationが既にある場合は上書きせず、別名作成、既存workspaceの検査、何もしない、の判断を利用者へ戻します。
- タスク作成に失敗しても、検証済みworkspaceを削除しません。
- タスクを作っていない場合は、workspace完成とタスク完成を分けて報告します。
