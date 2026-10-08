# Invocation and iteration examples

| User request | Interpretation |
|---|---|
| “AITuberの新機能を突然変異度80で5個” | Infer heterogeneous parents from theme; mutation 80; count 5 |
| “電子工作と生成AIを混ぜて。1万円以内” | Treat both themes as parent material; budget as hard constraint |
| “1番と4番を交配” | Use visible outputs 1 and 4 as parents |
| “3番の対象ユーザーを固定してさらに変異” | Lock Target from output 3 and mutate other loci |
| “機能だけ残して3世代” | Lock Function, repeat transform/select for three generations |
| “このプロジェクトから新サービス案” | Extract factual material from visible project conversation; do not fabricate missing facts |
| “アイデアをください” | Usually generic brainstorming; do not claim this skill unless the user asks for crossover, mutation, evolution, or derivation from existing concepts |

Example lineage, not hidden reasoning:

```markdown
### DNA
- Target ← 服薬通知アプリ
- Sensing method ← 植物の水分センサー
- Interaction ← Mutation: passive reminder becomes ambient physical feedback
- Target user ← Locked: 高齢者
```
