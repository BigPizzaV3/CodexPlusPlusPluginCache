# 実行環境ごとの機能境界

最終確認日: 2026-09-11

## 1. 利用に必要な環境

note Workspaceは、PluginまたはAgent Skillsを利用でき、利用者が選んだPC内のフォルダを読み書きできる環境で使います。保存・検証スクリプトにはPython 3.9以降が必要です。

同梱の[Plugin実行手順](../adapters/openai-plugin/README.md)と[デスクトップ操作手順](../adapters/desktop-local/README.md)を使い、AIが接続済み機能と権限を確認します。画像生成、役割別タスク、定期実行、noteへの下書き登録は、それぞれに必要な機能が利用可能な場合に使えます。

## 2. 環境の選び方

| 利用環境 | 利用時に確認すること |
|---|---|
| Codex Desktop / ChatGPT WorkのPC環境 | Skillの導入先、ローカルフォルダの読み書き権限、Python、接続済みの画像・ブラウザ・タスク機能 |
| CLI / IDE / その他のAgent Skills対応環境 | 9つのSkillを同じ親フォルダへ導入できることと、必要な実行機能。担当タスクを作れない場合は1タスク簡易運用を選べる |
| Web / モバイルのみ | 手元のPCフォルダを読み書きできる実行環境への接続が必要。接続できない場合、workspaceの作成・更新はPC側で行う |

各機能は実行時に `available`、`unavailable`、`unknown` を判定します。環境名だけで画像生成や下書き登録まで利用可能とは判断しません。

## 3. PluginとGitHubソースからの導入

導入手順は[`INSTALL.md`](../INSTALL.md)を正本にします。

Pluginでは、ホストの標準機能で一式を導入し、利用する会話で有効化します。導入済みの9 Skillを参照できることを確認してからセットアップを始めます。同梱のroot `plugin.json` が識別情報、`.codex-plugin/plugin.json` がCodex互換情報です。パッケージのインストールだけでworkspaceや担当タスクは作成しません。

Pluginを使わずGitHubソースからAgent Skillsを導入する場合は、次の手順を使います。

1. repository rootの`INSTALL.md`と`skill-pack.json`を読む。
2. host標準installerがGitHub repositoryまたはURLを扱える場合はそれを使う。
3. 指定がなければuser scope、明示があればproject scopeを使う。
4. source、ref、commit SHAを取得できる場合は記録する。
5. required Skillとentry Skillを検証する。
6. 同じ会話で`note-workspace-setup`を始める。
7. workspace検証後は、`START_HERE.md`の30秒案内を利用者へ示し、host adapterから`STUDIO.md`を読む通常運用へ切り替える。

具体的なinstall directoryはhostの公式仕様に従います。coreへ`~/.codex/skills`や`~/.agents/skills`等の一つのpathを固定しません。Skillが認識されない時は、現在のhostの探索pathを再確認します。

## 4. AI・カスタマイズ向け: 機能の確認

以下は、導入・実行を支援するAIと、環境をカスタマイズする方に向けた詳細です。

adapterは、次の能力を判定します。

| capability | note Workspaceで使う工程 |
|---|---|
| `skill_install` | PluginまたはGitHub sourceからの導入・更新と、現在の会話でのSkill参照 |
| `local_read` / `local_write` | workspace、一次情報、記事、設定 |
| `web_research` | 戦略調査、記事調査、現行仕様確認 |
| `task_create` | 利用者向け役割taskの作成、setup taskの安全な再利用、開始指示の送信 |
| `task_readback` | 実task、host、開始message、ready返答の検証可能な読取 |
| `scheduled_run` | 週間企画、計測 |
| `image_generate` | 見出し画像、任意の差し絵 |
| `image_resize` | 目標寸法への切り抜き・縮小、見出し画像previewの再現 |
| `browser_read` | 公開記事、creator画面、参考指標のread-only確認 |
| `browser_write` | noteの新規下書き登録 |
| `cloud_storage` | カスタマイズで同期を追加する場合だけ確認。同梱adapterの同期操作は非対応 |

`unknown`は`available`として扱いません。能力がない場合は該当工程だけを省き、記事、workspace、一次情報等の完成済み成果を失敗扱いにしません。

## 5. 定期実行

PC内のworkspaceを使う定期実行には、実行時にPCとアプリが動作し、そのフォルダへアクセスできることが必要です。アプリの定期実行機能を使い、次の条件を満たす場合に設定します。

- 計測と週間企画は、通常実行を一度確認してから別々に作り、計測を先、戦略を後にする。
- local projectを使うtaskは、対象workspaceと権限を限定する。
- trackerの定期実行はtracker task、戦略の定期実行はstrategy taskを対象にする。local設定には利用者が希望したscheduleだけを保存し、外部の作成状態をcacheしない。
- 作成、変更、再実行、状態報告、重複判定の前にplatformからautomation ID、対象task、schedule、次回実行を読み戻す。読み戻せない場合は`未確認`とし、作成済みとも未作成とも断定せず、新しい定期実行を重ねて作らない。
- 定期実行からPC内のworkspaceへ接続できない場合は、PC側での手動実行へ切り替える。
- 定期実行が失敗しても、取得不能値を`0`にせず、通常実行で再開できるようにする。

## 6. 標準5taskと1task簡易運用

1. 標準は、戦略、計測、記事制作、画像制作、日記の5つの利用者向けtaskにする。内部だけで見えるsubtaskではなく、利用者が開けるtaskを使う。
2. 現在のsetup task自身を戦略担当へtitle変更し、公式read-backで同じ会話とworkspaceの継続を確認する。確認前に別strategyを作らず、継続できない場合は新規role task作成前に停止する。
3. 各taskへ同じworkspace pathと役割の開始指示を送り、実際の担当案内とready返答を読み戻す。照合は[役割タスクの実行契約](../skills/note-workspace-setup/references/task-orchestration-contract.md)に従い、検証済みの結果だけを記録する。
4. 複数taskを望まない場合、またはtask作成能力がない場合は、`📝 note｜執筆サポーター`一つで同じ正本、品質gate、承認境界を使う。task作成能力がないhostへ複数taskの手動作成を必須にしない。
5. task作成、title変更、message送信、scheduled run作成はadapterの外部操作である。setup scriptはtaskを直接操作せず、SDKを必須dependencyにしない。

Coreはtask title、役割、開始指示、ready、受け渡し、完了receiptを定義し、特定SDKの関数名を仕様へ固定しません。会話履歴は継続状態の正本にせず、全taskが同じ`STUDIO.md`、運用設定、継続指示を読みます。

## 7. file保存

- local fileへ書ける環境では、利用者が確認したworkspaceへ保存する。
- source repositoryとSkill install先へruntime dataを保存しない。
- 画像は、利用者が後から見つけられる選択済み`assets/`または専用folderへ保存する。
- Webやmobileでlocal保存できない場合は、保存済みと装わず、会話内の完成物を手動保存するよう案内する。
- file処理が使えることと、利用者のPCへ保存できることを同一視しない。
- 同梱adapterはクラウド同期を扱わない。同期を追加する場合は、読み書き範囲と保存先を確認し、競合時の動作を別途定める。

## 8. 画像制作

- 記事一式を完成させ、タイトルを選んだ後に見出し画像を作る。
- 標準5taskでは、セットアップ済みの画像制作taskを毎記事で再利用し、小さな制作briefだけを渡す。
- 画像taskは生成だけで終わらず、asset保存、実寸と小表示のQA、記事制作taskへの完了receiptまで担当する。
- 記事制作taskは画像完了を待ち、記事と画像を一緒に納品してから下書き登録を確認する。
- 同時制作や長期化で追加の画像taskが必要な時だけ、理由と対象記事を示して個別承認を得る。hidden subtaskを標準にしない。
- 1task簡易運用または別taskを使えない環境では、同じtask内で同じbrief、QA、納品順を守る。
- 見出し画像は1280×670pxと320×168pxの実表示、差し絵は1280×720pxと挿入位置・caption・ALTを確認する。
- QAを通過した完成画像だけを利用者workspaceへ追記保存する。
- 画像の`generated_at`、`reviewed_at`、`saved_at`を分け、`記事保存 < 画像生成 < 目視QA <= asset保存`を検証する。
- 見出し画像の8-bit RGB/RGBA・非interlace PNGは、標準ライブラリの決定的な処理で1280×670pxから320×168pxを再現できる。RGBAはalpha事前乗算で補間し、QAしたpreview hashと保存時の再生成結果を一致させる。入力量、pixel数、宣言寸法に対する展開量を検査し、安全性エラーはbackend fallbackの対象にしない。
- JPEGや特殊PNGを寸法変換する場合は、Pillow、ImageMagick、`sips`、`ffmpeg`等の利用可否を`image_resize`として先に確認する。利用不能なら変換済みと装わず、対応PNGを生成し直すかbriefまでで止める。
- 生成失敗や利用制限が起きても、完成済みの記事を失敗扱いにしない。
- 画像生成がない環境では、一方向に絞った制作briefを返す。

## 9. note下書き登録

利用者の環境で利用可能なbrowser操作面を、その時点で確認して選びます。UI名や優先順位をcoreへ恒久固定しません。

browser操作が使えなくても記事と画像は完成できます。セットアップ時に下書き登録を希望していても、個別記事の完成後に「noteの下書き登録まで進めますか？ 公開はしません。」と確認し、その一件だけを書き込みます。

承認後は`note-draft`が記事revision、QA済み画像、URLをlocal packageへ固定します。`記事保存 < 画像生成 < 目視QA <= asset保存 < 利用者承認`を満たさない場合や、asset保存と承認が同時刻の場合はpackageを作りません。最初の文字入力直前に開始eventを記録し、保存、非公開、editor終了を確認できた時だけ結果を記録します。開始後の状態が不明な時は、同じ下書きの途中保存を照合し、新しい下書きを追加作成しません。

現在のbrowser能力が`unknown`または`unavailable`なら、承認packageと完成物を維持して低下経路へ切り替えます。登録済みと装わず、操作可能なデスクトップ環境で再開します。

## 10. Webとmobileの案内

- 一記事単位で完結したい場合はminiを案内する。miniはデスクトップでも選べる。
- note Workspaceの設計相談だけ進める場合も、local workspaceを作成済みとは報告しない。
- PCで構築済みのnote Workspaceを使う場合は、そのworkspaceへ接続できるhostから操作する。同梱adapterにクラウド同期は含まれない。
- PluginとAgent Skillsのどちらも非対応のhostで、導入済みと装わない。継続workspaceが目的なら対応hostへの引き継ぎ、一記事が目的ならminiを案内する。
