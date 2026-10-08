#!/bin/sh

# Start the animated dashboard in a new Terminal window.
#
# A new tab cannot be opened reliably from another process. Terminal's
# `do script ... in window` types into the selected tab, which is Codex, so
# the command is pasted into the prompt and never runs. A bare `do script`
# opens a new window and runs the command there. Never write into the
# current tab, and never close a tab from here.
codex_cost_script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "$codex_cost_script_dir" ]; then
  printf '%s\n' 'Codex Cost: unable to locate the installed skill.'
  exit 1
fi
codex_cost_launcher="$codex_cost_script_dir/inspect.sh"
if [ ! -f "$codex_cost_launcher" ]; then
  printf '%s\n' "Codex Cost: the launcher is missing at $codex_cost_launcher."
  exit 1
fi

codex_cost_skip_next=0
codex_cost_command="/bin/sh '$codex_cost_launcher'"
for codex_cost_argument in "$@"; do
  if [ "$codex_cost_skip_next" = 1 ]; then
    codex_cost_skip_next=0
    continue
  fi
  case "$codex_cost_argument" in
    --takeover) continue ;;
    --seconds) codex_cost_skip_next=1; continue ;;
  esac
  codex_cost_command="$codex_cost_command '$codex_cost_argument'"
done
codex_cost_applescript_command=$(printf '%s' "$codex_cost_command" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

# A bare `do script` uses Terminal's default profile, so the new window does
# not pick up the front window's background, colors, or font. Copy those first.
codex_cost_result=$(osascript <<APPLESCRIPT 2>&1
tell application "Terminal"
  activate
  set codexCostSettings to missing value
  set codexCostBounds to missing value
  if (count of windows) > 0 then
    set codexCostSource to selected tab of front window
    set codexCostSettings to current settings of codexCostSource
    set codexCostBounds to bounds of front window
  end if
  set codexCostTab to do script "$codex_cost_applescript_command"
  set custom title of codexCostTab to "Codex Cost"
  if codexCostSettings is not missing value then
    set current settings of codexCostTab to codexCostSettings
    try
      set background color of codexCostTab to background color of codexCostSource
      set normal text color of codexCostTab to normal text color of codexCostSource
      set bold text color of codexCostTab to bold text color of codexCostSource
      set cursor color of codexCostTab to cursor color of codexCostSource
      set font name of codexCostTab to font name of codexCostSource
      set font size of codexCostTab to font size of codexCostSource
    end try
  end if
  if codexCostBounds is not missing value then
    try
      set bounds of front window to codexCostBounds
    end try
  end if
end tell
APPLESCRIPT
)
codex_cost_status=$?

if [ "$codex_cost_status" -eq 0 ]; then
  printf '%s\n' 'Codex Cost: started the animated dashboard in a new Terminal window. Press q there to close it.'
  exit 0
fi

printf '%s\n' "Codex Cost: could not start the dashboard ($codex_cost_result)." \
  'Re-run this same command with permission to control Terminal.app.' \
  'Do not type the command into the current tab, and do not print a static report.'
exit 1
