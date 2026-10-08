#!/usr/bin/env bash
# リポジトリ直下で実行すること（相対パスで src/ を参照）
set -euo pipefail
python src/main.py \
  --assumptions assumptions.sample.yaml \
  --rent-roll-pdf data/sample_rentroll_simple.pdf \
  --output ./output \
  --excel-output ./output/direct_cap.xlsx
