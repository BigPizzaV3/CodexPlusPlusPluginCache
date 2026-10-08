# 導入方法

note Workspaceは、9つのSkillをまとめたプラグインです。利用には、PCのフォルダを読み書きできる環境とPython 3.9以降が必要です。利用者向けの開始文は[README](README.md#はじめ方)、普段の使い方は[ガイド](GUIDE.md)を参照してください。

## プラグインを使う

1. 入手したnote Workspaceプラグインを、利用するアプリの標準機能でインストールする。
2. 利用する会話で `note Workspace｜ROGNALIA` を選ぶ。
3. 次の一文を送る。

```text
自分専用のnote Workspaceをセットアップして。分からない点は一緒に決めたい。
```

すでに作った環境を使う場合は、新しく作り直さず、保存済みのフォルダを指定してください。

```text
前に作ったnote Workspaceを使いたい。保存先を確認して、続きから進めて。
```

プラグインの導入と、専用フォルダ・担当タスク・定期実行の作成は別の操作です。セットアップでは、AIが保存先と作成するものを提案し、確認後に作ります。プラグインを削除しても、別の場所に保存した記事やメモは自動削除しません。

## AIエージェント向け: Pluginの確認と開始

- Plugin manifestはルートの `plugin.json`。OpenAI固有の表示情報は `extensions.com.openai`、Codex互換情報は `.codex-plugin/plugin.json` にある。
- 同梱Skill一覧とentry Skillは[`skill-pack.json`](skill-pack.json)を読む。`distribution` は `openai-plugin`。
- 9つのSkillの `SKILL.md`、frontmatterの `name`、元のフォルダ名と同階層の配置を確認する。
- Pluginを選んだ現在の会話で、`note-workspace-setup` と必要な同梱Skillを参照できることを確認する。インストール済みでも、会話から使えない状態を準備完了と報告しない。
- [Plugin実行手順](adapters/openai-plugin/README.md)を読み、利用可能な機能、同名Skillの区別、再開先を確認する。
- インストール時に同梱scriptを実行しない。導入完了後はentry Skillを読み、既に分かっている情報を引き継いでセットアップを始める。
- ホストの再読み込みや新しい会話が必要な場合だけ、その必要性と次の一文を伝える。

```text
note Workspaceプラグインを選んで、セットアップを続けて。
```

## ソースから導入する

GitHubのソースから導入する場合は、次をAIへ送れます。

```text
https://github.com/Poke-nushi/rognalia-note-workspace

このソースの導入手順を確認して、note Workspaceを使えるようにして。
```

### Pluginとしてまとめる場合

ソースのルートで、検証と梱包を行えます。出力先にはソース外の新しいファイルを指定します。ZIPには配布一覧にあるファイルだけが入り、既存のZIPは上書きしません。

```bash
python3 scripts/validate_plugin_package.py
python3 scripts/build_plugin.py --output /absolute/path/to/output/rognalia-note-workspace.zip
```

`plugin-package.json` は同梱ファイルの明示一覧です。フォルダ構成を保って展開し、ホストのローカルPlugin導入機能へ渡してください。ローカル導入の方式は[OpenAI公式手順](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)を参照します。既存のPluginやMarketplace情報は上書きせず、sourceとversionの衝突を確認します。

### Agent Skillsとして導入する場合

Plugin非対応でAgent Skillsに対応する環境では、[`skill-pack.json`](skill-pack.json)に列挙された9つのSkillを導入できます。

- ホスト標準installerを優先する。scope指定がなければuser scope、特定projectだけとの指定があればproject scopeにする。
- 全Skillを元のフォルダ名で同じ親フォルダに置き、相互参照を維持する。manifestにないSkill、未実装Skill、利用者workspace、fixtureを含めない。
- 同名Skillがある時はsourceとversionを比較し、黙って上書きしない。source URL、ref、commit SHAを記録できる場合は記録する。
- この経路ではPluginやMarketplaceを新規作成しない。同梱scriptもインストール時には実行しない。
- 全required Skillと `note-workspace-setup` の認識を確認後、その手順からセットアップを開始する。Plugin専用adapterは使わない。
- 標準installerがなく、正式なSkill探索先も不明な場合は推測せず、現在のホストと必要な次の一手を確認する。

CodexでのSkill導入とタスク操作は[Codex adapter](adapters/codex-standalone/README.md)を参照します。

## AIエージェント向け: 通常運用への引き継ぎ

セットアップ後は、保存先の `START_HERE.md` と `STUDIO.md` に従って、標準5タスクまたは1タスク簡易運用を使います。通常の記事制作やメモ保存で初回質問へ戻りません。

AIはフォルダのvalidatorに加え、承認済みの担当タスクを作った場合は実タスクの開始指示とready返答を読み戻し、専用verifierとbinding validatorで検証します。空タスク、自己申告、手作りのread-backを完成扱いにしません。タスク作成や定期実行に非対応の環境では、作成済みと装わず、その会話で使える簡易運用を案内します。

完了時はファイルへのリンクだけで終えず、普段話しかけるタスクと最初の一言を会話でも案内します。定期実行は希望scheduleと実際の作成状態を分け、現在のhostから読み戻せない時は `未確認` と報告します。

## 更新と削除

- Plugin versionと、workspaceのschema/generator versionを区別する。ソース導入ではrefまたはcommit SHAも確認する。
- 更新前に変更内容とworkspace移行の要否を伝える。同じsource・versionなら重複導入しない。
- 移行が必要なら、データを変更しない事前確認（dry-run）、バックアップ先、復元方法を示して承認を得る。
- PluginやSkillの更新・削除は、利用者workspaceを上書き、移動、削除する承認にしない。
- ホストの公式機能でPluginを再読み込みし、同梱Skillが更新されたことを確認してから、既存workspaceの通常運用を再開する。
