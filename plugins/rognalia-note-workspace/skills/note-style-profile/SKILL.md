---
name: note-style-profile
description: note Workspaceで、利用者本人が権利を持つ過去記事、下書き、文章サンプルから書き方の傾向だけを抽出し、確認済みの文体プロフィールを履歴付きで保存・更新する。自分らしい文体へ近づけたい、避けたい癖を決めたい、文体プロフィールを見直したい時に使う。記事固有の事実、個人属性、元本文はプロフィールへ保存しない。
---

# note Workspace 文体プロフィール

## 役割

本人が書いた文章から、語り口、文の長さ、読点、改行、導入、見出し、具体性、好む表現、避ける表現を整理する。過去記事を複製するのではなく、今後の記事で本人らしさを再現しやすくする設定を作る。

利用者向けの入口は、初回の戦略task、普段の記事制作task、または1task簡易運用であり、Skill名を指定させない。記事制作中の今回の指定は、保存済みプロフィールより常に優先する。

## 必ず読むもの

- 利用者workspaceの`STUDIO.md`、`workspace.json`、`profile/style-profile.md`、`profile/standing-instructions.md`。
- [`references/style-profile-contract.md`](references/style-profile-contract.md)。
- 保存する時は[`references/schemas/style-profile-input.schema.json`](references/schemas/style-profile-input.schema.json)。

## 入力を絞る

本人が書いた、または分析する権限を持つ文章を2〜5本使う。一記事だけでも始められるが、結果は`provisional`とする。公開URL、利用者workspace内の下書き、添付、会話へ貼られた文章を使える。

最初に一度だけ次を確認する。

- 今後も残したい自分らしさ。
- 自分でも直したい癖。
- 記事ごとに変えてよい部分。

本文が長い時も、必要以上の記事や生ログ全体を読まない。分析対象へ第三者の文章が混ざる場合は、その部分を本人の文体根拠にしない。

## 書き方だけを分析する

次を、観察できた傾向と利用者の希望に分けて整理する。

- 読者との距離、敬体・常体、温度。
- 一文の長さ、長短のリズム、読点、改行。
- 導入、見出し、節の長さ、締め方。
- 場面、会話、数字、感情、ユーモアの使い方。
- 残したい表現、本人が避けたい表現。
- 言い切りと不確実性の表し方。
- 記事ごとに決めるトーン、長さ、画像表現。

特定の語、比喩、語尾の制約は、利用者が望む場合にだけ設定する。提供側の好みや一般的な「AIらしい表現」の一覧を、本人の希望として持ち込まない。

職業、年齢、居住地、顧客、家族、健康、信条等を文体設定として推測しない。記事の固有名詞、出来事、成果、長い言い回し、本文抜粋をプロフィールへ転記しない。

## 確認後だけ保存する

最初は会話内で案を示し、根拠が一記事だけ、記事間で揺れる、または利用者の希望と観察が違う項目を断定しない。

次の意味を明確にして確認する。

> この文体プロフィールを、今後の記事で使う設定として保存しますか。直したい項目があれば先に反映します。

承認前は`profile/style-profile.md`を書き換えない。承認後は、元文章を入力JSONへ含めず、sample ID、種類、文字数、SHA-256だけを保存scriptへ渡す。

```bash
python3 scripts/save_style_profile.py \
  /absolute/path/to/user-workspace \
  --config /absolute/path/to/style-profile-input.json
```

保存scriptは現在版を`profile/style-profile.md`へ置き、旧版、metadata、registry eventを追記型で残す。同じrequest IDと同じ内容は既存revisionを返し、同じIDで内容が違う時は停止する。process強制終了でjournalとlockが残った時は、記録したprocessが終了済みであることを確認して同じrevisionを回復する。現在版がjournal開始時とも保存予定版とも異なる場合は、利用者または別processの変更として上書きせず停止する。保存後は`validate_style_profiles.py`を実行する。

## 記事制作への適用

- `note-writer`は記事ごとの構成とトーンを決める時に現在版を読む。
- 戦略、記事制作、画像の各taskは会話履歴から文体を推測せず、同じcurrent profileを読む。
- 今回の明示指定がプロフィールと違う時は、今回の指定を優先する。
- `note-draft-quality`の一次性・文体確認を省略しない。
- 過去記事にある経験、感情、成果、引用を今回の記事へ移植しない。
- プロフィールは型の強制ではない。記事ごとに選ぶ項目を固定しない。

## 完了条件

- 本人が権利を持つ1〜5本だけを根拠にしている。
- 内容や個人属性ではなく書き方だけを整理している。
- 観察、利用者の希望、不確実な項目を混同していない。
- 利用者の確認前にworkspaceを書き換えていない。
- 保存物に元本文、private URL、個人情報、Plugin cacheの変更を含めていない。
- 保存時はrevision、hash、registryのvalidatorがpassしている。
