# note Workspace Plugin実行手順

## 導入と実行の確認

このPluginは `rognalia-note-workspace`。`skills/` の9つのSkillを一式で使います。外部API、MCP server、認証、インストール時に動くhookは含みません。

現在の会話でPluginが有効であり、`note-workspace-setup` と必要な同梱Skillが参照できることを確認します。Pluginのインストール、会話での有効化、利用者workspaceのセットアップを同じ完了状態にしません。

Skillはインストール済みの当該 `SKILL.md` の場所から解決します。別Skillの参照先は同じ `skills/` 配下の兄弟フォルダです。`note Studio mini` と同名の `note-draft`、`note-style-profile` がある場合も、名前の一致だけでmini側へ切り替えず、このPlugin内のSkillを読みます。

scriptは当該Skillのフォルダを作業場所とするか、インストール済みscriptへの絶対パスで実行します。現在の作業フォルダに `scripts/` があるとは仮定しません。Pluginの版やcache pathを利用者workspaceへ恒久固定せず、新しい会話では現在の導入先を再確認します。

## 必要な実行機能

利用者が選んだPCのフォルダを読み書きでき、Python 3.9以降を実行できることを確認します。クラウドの一時ファイルを扱えるだけでは、利用者のPCへ保存できることにはなりません。接続できない場合は提案までを返し、作成済みと報告しません。

画像、ブラウザ、担当タスク、定期実行は、その会話で使える機能と権限を確認します。[機能境界](../../docs/platform-capabilities.md)と[デスクトップ操作](../desktop-local/README.md)に従い、未対応の操作は完了済みとせず、既にできた成果を保持します。noteへの入力時は[下書き手順](../desktop-local/note-draft.md)、指標を読む時は[計測手順](../desktop-local/note-tracker.md)を読みます。

## 初回と継続利用

初回は [`note-workspace-setup`](../../skills/note-workspace-setup/SKILL.md) を使い、保存先と作成対象の提案を確認してから作成します。インストールしただけでは、利用者のフォルダや担当タスクを作りません。Plugin本体、cache、source repositoryを保存先に選びません。

既存workspaceがある場合は、利用者が指定した場所の `workspace.json` と `STUDIO.md` を読み、正常なworkspaceなら今回の依頼を担当する同梱Skillへ進みます。別の会話になっただけでセットアップをやり直しません。場所が不明な場合は、保存先を確認する質問を一つ返し、PC全体から私的資料を探索しません。

## 担当タスクへの接続

Codexの役割タスク操作は [Codex adapterの再読み込み以降](../codex-standalone/README.md#再読み込み) を使います。Standalone向けのSkillインストールは繰り返しません。

専用scriptが発行する開始指示には、同じworkspaceと役割に加え、note Workspace Pluginとその同梱Skillの確認が含まれます。nonce付きの開始指示は追記・改変せずそのまま送ります。新しいタスクへPluginの有効状態が自動継承されるとは仮定しません。ホストの公式機能で確認し、利用できないタスクをreadyにしないでください。

必要なSkillを使えない場合は、有効化に必要な一手を案内して該当タスクのbindingを保留します。代わりの空タスクを増やしたり、インストール済みファイルをworkspaceへコピーしたりしません。複数タスクに対応しない環境では、利用者が選んだ1タスク簡易運用で同じ品質・承認条件を使います。

## 更新と削除

ホストの公式Plugin更新・削除機能を使います。同名Pluginのsourceが異なる場合は黙って上書きしません。更新後は必要なSkillを再認識し、既存workspaceをvalidatorで確認してから継続します。Pluginの削除では、利用者のworkspaceを変更・削除しません。
