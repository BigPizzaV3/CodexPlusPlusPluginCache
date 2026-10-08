---
name: revenue-kun
description: Use this skill when developing, validating, documenting, or running
  revenue-kun — a real-estate direct-capitalization income-estimation CLI/Skill that
  parses rent-roll inputs (CSV / text-based PDF) and generates an inspectable Excel
  workbook (収益試算値). Do not use for appraisal opinions, investment/legal/tax advice,
  OCR/scanned PDFs, or any "real-world PDF verified" claim (Issue #21 open).
---

# revenue-kun (Codex Agent Skill)

## Purpose
revenue-kun の開発・検証・ドキュメント・サンプル実行を補助する。リポジトリ内で動作し、
エンジンは `src/` を直接呼ぶ（複製しない）。

## Product position
GitHub OSS の研究・検証用 CLI/Skill。商用 SaaS でも完成鑑定プロダクトでもない。

## Standard workflow
1. branch / status / 関連 issue を確認。
2. README・リリースノート・GUARDRAILS.md を読む。
3. エントリポイント `python src/main.py` を確認。
4. サンプル実行（`scripts/run_sample.sh` または AGENTS.md の run コマンド）。
5. `python -m pytest -q` を通してから挙動を主張。
6. 検証範囲を超える主張をしない。

## Local Web UI 起動
ユーザーが「revenue-kunを起動して」「revenue-kunのWeb UIを開いて」「ブラウザで使いたい」等（文脈上revenue-kunの話であることが明らかな場合）と依頼した場合は、`python src/main.py` の実行ではなく、Local Web UIを起動する。

1. 事前に `curl -s http://127.0.0.1:8000/healthz` で確認する。`{"status":"ok"}` が返れば既存プロセスを再利用し、再起動しない。判別できないレスポンスの場合は、既存プロセスを流用・終了せず、別ポートの可否をユーザーに確認する。
2. 起動コマンド（リポジトリルートで実行、バックグラウンド起動、後続操作をブロックしない）:
   ```bash
   python -m uvicorn webui.app:app --host 127.0.0.1 --port 8000
   ```
3. `127.0.0.1` 限定bind。`0.0.0.0` や外部公開はしない。ホスティング型SaaSであるかのような表現もしない。
4. 起動後、health checkで確認したうえで `http://127.0.0.1:8000/` をユーザーへ案内する。
5. 起動失敗時は原因（依存未導入・ポート競合等）を要約して伝える。「起動しました」と未確認のまま報告しない。
6. この分岐は `webui/` を含むこのリポジトリ環境でのみ有効。CLIによる `direct_cap.xlsx` 生成フロー自体は変更しない。

## Guardrails
スコープ・必須用語・禁止表現はリポジトリ直下の GUARDRAILS.md を正本とする。要点：
- 出力は「収益試算値」。鑑定評価・収益価格ではない。
- 数値（還元利回り等）を提案しない。欠損は補完しない。
- 「実務検証済み」「リリース済み」「完全互換」「全エージェント対応」と書かない。
