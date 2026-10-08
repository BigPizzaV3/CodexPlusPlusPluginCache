# Codex Standalone Skill導入adapter

最終確認日: 2026-08-28

## 目的

このadapterの導入手順は、Pluginを使わずAgent Skillsとして入れる場合に使います。Plugin導入では[Plugin実行手順](../openai-plugin/README.md)を読み、以下のタスク操作だけを共通利用します。

GitHub repository URLと自然文を受け取り、note WorkspaceのSkillをCodexが認識するscopeへ導入し、そのまま`note-workspace-setup`による導入支援を開始します。このrepositoryを導入する途中で、別のPlugin packageやMarketplace sourceへ変換しません。

## 標準手順

1. repository rootの`INSTALL.md`と`skill-pack.json`を読む。
2. Codexに組み込みのSkill Installerが利用できる場合は、それへrepository URLとmanifest掲載pathを渡す。
3. scope指定がなければuser scopeへ導入する。
4. 「このrepositoryだけ」「このprojectだけ」と明示された場合は、現行のrepository scopeへ導入する。
5. required Skillの`SKILL.md`とfrontmatter nameを確認する。9つのSkillを元のフォルダ名で同じ親フォルダに置き、相対参照を確認する。
6. Codexが新しいSkillを認識したら`note-workspace-setup`を開始する。
7. workspaceのvalidatorがpassしたら、承認済みのtask modeに従い、標準5タスクまたは1タスク簡易運用をセットアップする。
8. 各taskの実IDとhost IDからランダムな一回限りnonce付き開始指示を作り、送信後にCodexのtask読取機能で開始messageとready返答を読み戻す。そのhost返値をUTF-8の標準入力または承認済み一時JSONで`verify_role_task_readback.py`へ渡し、ID、host、title、開始文全文、workspace、role、nonce、時刻が一致することを確認する。host固有のJavaScript base64機能は前提にしない。
9. verifierが発行したbinding configだけを記録してchallengeを消費し、task binding validatorがpassしたら、生成された`START_HERE.md`の30秒案内を利用者へ示し、`AGENTS.md`から`STUDIO.md`を読む通常運用へ切り替える。host read-backが使えない時はtask完成と報告しない。

Skill Installerは、curated list以外のGitHub repositoryとrepository内pathも扱えます。[OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) / [OpenAI: skill-installer](https://github.com/openai/skills/blob/main/skills/.system/skill-installer/SKILL.md)

## pathの扱い

Codexが探索するSkill rootは製品更新で変わり得ます。user scope、repository scopeとも、そのreleaseの公式仕様と組み込みinstallerが選ぶ場所を優先します。core Skillや利用者向けREADMEへ、一つの絶対pathを恒久固定しません。

組み込みinstallerが使えず、公式仕様に沿った手動copyが必要な場合だけ、manifest掲載の各Skill folderを対応scopeへ置きます。repository全体、`docs/`、`tests/`、`evals/`、利用者workspaceをSkill directoryへcopyしません。

## 再読み込み

現在のprocessが導入直後のSkillを認識できる場合は、会話を切らずにsetupを始めます。再起動または新しいtaskが必要な場合だけ、次の一文を返します。

```text
note Workspaceのセットアップを続けて。
```

標準5タスクでは、現在のセットアップtaskを`🧭 note｜戦略・編集方針`として再利用するのが既定です。新しいtaskを作る前に`set_thread_title`を`threadId`なしで呼び、呼び出し元の現在task自身を改名します。変更結果または公式task read-backから現在taskの実ID、host ID、titleを確認し、strategyのkickoffを`reused_setup`として扱います。その後に`📊 note｜計測・公開ログ`、`✍️ note｜記事制作`、`🎨 note｜画像制作`、`📔 note｜日記・体験ログ`の4taskを`create_thread`で作ります。この経路でstrategyへ`create_thread`を使いません。

現在taskの改名、同じ会話の継続、または公式read-backを確認できない場合は、新しい役割taskを一つも作らず停止します。別strategyを作るとsetup taskが別に残ることを利用者へ示し、その構成変更が明示承認されるまで余分なsetup taskを残す構成へ進みません。改名後に現在taskのready read-backを同じturnで完了できない場合は、同じtaskのfollow-up turnで続け、別strategyを代替作成しません。task作成、rename、message送信は外部状態なので、セットアップ提案で承認された対象だけを扱います。hidden subtaskは標準構成にしません。

セットアップ完了後は、記事を書く時は記事制作taskへ、出来事を話したい時や質問してほしい時は日記taskへ話しかけます。戦略は方針相談、trackerはplatformで定期実行済みと確認できた場合は原則自動、imageは通常writerから依頼されます。各taskは最初のmessageですでに担当範囲、普段開く必要、最初の一言を案内済みであり、利用者に空taskを起動させません。5taskは同じworkspaceを読むため、Skill IDの指定、task間の情報コピー、セットアップtaskへの再移動を求めません。設定変更、移行、修復の時だけ`note-workspace-setup`へ戻ります。

trackerとstrategyのheartbeatを希望する場合は、設定済みscheduleと対象taskを直前に再確認します。`📊 note｜計測・公開ログ`を先に動かし、その完了時刻とstatusを確認できる間隔を空けて`🧭 note｜戦略・編集方針`を動かします。localの`automation_preferences`は希望だけを記録します。作成、変更、再実行、状態報告、重複判定の前後にCodexからautomation ID、対象task、schedule、次回実行を読み戻し、trackerが先であることを確認します。読み戻せない時は`未確認`とし、作成済みとも未作成とも断定せず、同じheartbeatを追加しません。heartbeatの作成はworkspace作成とは別承認です。

## 衝突と更新

- 同じsourceと同じref/SHAなら重複installを作らず、setupへ進む。
- 同名でsourceが違う場合は上書きしない。
- 同じsourceでversionが違う場合は、更新内容を示してからupdateする。
- update後もruntime workspaceを変更しない。
- uninstallは導入したSkillだけを対象にし、workspaceを削除しない。
