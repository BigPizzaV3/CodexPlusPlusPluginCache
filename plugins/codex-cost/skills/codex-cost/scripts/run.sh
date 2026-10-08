#!/bin/sh

# Run the bundled dashboard with Node.js 22.13 or newer. The `node` on PATH
# is often an older nvm install; this launcher picks a compatible one.
codex_cost_script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "$codex_cost_script_dir" ]; then
  printf '%s\n' 'Codex Cost: unable to locate the installed skill.'
  exit 1
fi

# A CLI agent has no /dev/tty. Open a Terminal window instead of failing later.
codex_cost_takeover=0
for codex_cost_argument in "$@"; do
  case "$codex_cost_argument" in --takeover) codex_cost_takeover=1 ;; esac
done
if [ "$codex_cost_takeover" = 1 ] && { [ ! -t 0 ] || [ ! -t 1 ]; }; then
  exec /bin/sh "$codex_cost_script_dir/open.sh" "$@"
fi

codex_cost_node=''
codex_cost_path_node=$(command -v node 2>/dev/null || true)
for codex_cost_candidate in "$codex_cost_path_node" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -x "$codex_cost_candidate" ] && "$codex_cost_candidate" -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1);
  ' >/dev/null 2>&1; then
    codex_cost_node=$codex_cost_candidate
    break
  fi
done

if [ -z "$codex_cost_node" ]; then
  printf '%s\n' 'Codex Cost needs Node.js 22.13 or newer.' 'Install Node.js, then open this launcher again.'
  exit 1
fi

exec "$codex_cost_node" "$codex_cost_script_dir/codex-cost.mjs" "$@"
