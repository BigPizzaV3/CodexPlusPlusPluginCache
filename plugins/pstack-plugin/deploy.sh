#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output_dir="$script_dir/dist"
archive="$output_dir/pstack-plugin.zip"

mkdir -p "$output_dir"
rm -fr "$output_dir/*"
rm -f "$archive"

(
  cd "$script_dir"
  zip -rq "$archive" . -x 'dist/*' '.git/*'
)

echo "Created $archive"
