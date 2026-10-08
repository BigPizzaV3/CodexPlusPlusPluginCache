#!/bin/sh

# Runs the dashboard in the terminal that invoked it. This launcher deliberately
# has no .command extension, so macOS will not open it in a new Terminal window.
codex_cost_script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "$codex_cost_script_dir" ]; then
  printf '%s\n' 'Codex Cost: unable to locate the installed skill.'
  exit 1
fi

# Match the selected ASCII motion previews; explicit color flags take precedence.
codex_cost_color='--color'
for codex_cost_argument in "$@"; do
  case "$codex_cost_argument" in --color|--no-color) codex_cost_color='' ;; esac
done
if [ -n "$codex_cost_color" ]; then
  /bin/sh "$codex_cost_script_dir/run.sh" --inspect --ascii --color "$@"
else
  /bin/sh "$codex_cost_script_dir/run.sh" --inspect --ascii "$@"
fi
codex_cost_status=$?

# Only a deliberately spawned window needs to stay open to show an error.
if [ "$codex_cost_status" -ne 0 ] && [ -n "$CODEX_COST_NEW_WINDOW" ] && [ -t 0 ]; then
  printf '\nPress Return to close this window. '
  read -r codex_cost_reply
fi
exit "$codex_cost_status"
