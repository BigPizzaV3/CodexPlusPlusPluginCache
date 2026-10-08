# Low mutation example

## Prompt

`電子工作・夏・食べ物。Mutation Lowでアイデア生成`

- Mutation: Low / 20
- Parent A: 夏の弁当箱の保冷
- Parent B: 電子工作の温度センサー
- Constraint: 持ち運べる昼食向け。実現性を優先。

## Idea 1 — 温度警告ランチバンド

弁当箱に巻くだけで、傷みやすい温度帯に入ると色で知らせるバンド。

### Concept

保冷剤ポケット付きの弁当バンドに温度センサーと小さな表示部を組み込み、保冷が弱まった時間だけ黄から赤へ変化させる。保冷そのものは変えず、確認の仕組みだけを足す。

### Why it is interesting

夏の弁当管理で見えなかった温度変化を、スマートフォンなしで一目にできる。

### DNA

- Physical form ← Parent A: 弁当箱の保冷バンド
- Sensing ← Parent B: 温度センサー
- Interaction ← Mutation: 保冷状態を色で警告
- Constraint/Lock ← Preserved: 持ち運べる昼食向け

## Idea 2 — 食べ頃LEDピック

冷やした果物やデザートに刺すと、食べ頃の温度を小さな LED で示すピック。

### Concept

温度センサーを先端に持つ再利用可能なピックを、保冷バッグから取り出した食品に刺して使う。設定温度に達したら青い LED が点灯し、冷やし過ぎやぬるさを避ける。

### Why it is interesting

保冷という受け身の機能を、食べる瞬間の判断へ近い仕組みだけ変えている。

### DNA

- Context ← Parent A: 夏の保冷バッグ内の食品
- Technology ← Parent B: 温度センサーと LED
- Purpose ← Mutation: 温度維持から食べ頃の合図へ
- Constraint/Lock ← Preserved: 小型で再利用可能

## Idea 3 — 保冷剤交換タイマー

保冷剤の交換時刻を、弁当箱の留め具で静かに知らせるタイマー。

### Concept

保冷剤を入れた時点でボタンを一度押すと、設定時間後に留め具の小さなランプが点滅する。温度を詳細記録せず、暑い日の交換忘れだけを防ぐ。

### Why it is interesting

既存の保冷運用に、もっとも近い電子的な時間管理を加えるため、低い突然変異度でもすぐ試せる。

### DNA

- Function ← Parent A: 保冷剤の使用
- Mechanism ← Parent B: 小型電子タイマー
- Timing ← Mutation: 交換時刻の通知
- Constraint/Lock ← Preserved: 複雑な設定を不要にする
