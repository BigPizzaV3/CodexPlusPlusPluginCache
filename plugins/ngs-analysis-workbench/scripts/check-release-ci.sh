#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  printf 'The NGS release check requires a Linux CI worker.\n' >&2
  exit 1
fi

plugin_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd -- "$plugin_root/../../../.." && pwd)"
node_version="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["engines"]["node"])' "$repo_root/package.json")"

if [[ ! "$node_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  printf 'The root package.json must pin an exact Node version: %s\n' "$node_version" >&2
  exit 1
fi

# Use the reviewed runtime archive; never stage a new toolchain from CI.
if [[ ! -f "$repo_root/lib/js/oai_js/oai_js/node/v$node_version/manifest.json" ]]; then
  printf 'Missing reviewed Node archive manifest for %s\n' "$node_version" >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ngs-release-ci.XXXXXX")"
trap 'rm -rf -- "$work_dir"' EXIT

cd "$repo_root"
oaipkg run oai_js.install_node "node_version=$node_version" "prefix=$work_dir/node"
export PATH="$work_dir/node/bin:$PATH"
[[ "$("$work_dir/node/bin/node" --version)" == "v$node_version" ]]

cd "$plugin_root"
# Hydrate pinned UI inputs for the build and Python resource tests.
blobdata download oai-maintained-plugins \
  --repo-root "$repo_root" --filter '^plugins/ngs-analysis-workbench/(assets/app-icon\.png|mcp/mcp-(app|inline)\.html)$'
npm ci --no-audit --no-fund
npm run check:release

# Exercise the same isolated Python runtime shipped with the plugin.
cd "$plugin_root/mcp"
export CODEX_HOME="$work_dir/codex"
export ROSALIND_SENTRY_ENABLED=0
export NGS_ANALYSIS_WORKBENCH_STATE_DIR="$work_dir/state"
export PYTHONPATH=.
./start_server ngs_app_mcp </dev/null
"$CODEX_HOME/cache/ngs-analysis-workbench/venvs/$(cat PLUGIN_VENV_VERSION)/bin/python" \
  -m unittest discover -s ../tests -p 'test_*.py'
