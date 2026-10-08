#!/bin/sh

# Open the dashboard in a NEW TAB of the frontmost Terminal window.
#
# macOS has no "open this file in a tab" command: `open -a Terminal file` always
# creates a window, and AppleWindowTabbingMode does not change that for
# Terminal.app. A tab only exists as a UI action, so this drives Cmd-T through
# System Events and then runs the launcher in the tab that appears.
#
# Requires Terminal to be scriptable from this process: System Events needs
# Accessibility permission, and a sandboxed shell blocks Apple Events outright.
# Codex CLI's default sandbox denies both Apple Events and LaunchServices, so
# neither a tab nor a window is reachable from there.

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

# Build the shell command the new tab will run, quoting the path for the shell
# inside Terminal and then for AppleScript's own string literal.
codex_cost_command="/bin/sh '$codex_cost_launcher'"
for codex_cost_argument in "$@"; do
  codex_cost_command="$codex_cost_command '$codex_cost_argument'"
done
codex_cost_applescript_command=$(printf '%s' "$codex_cost_command" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

# Only ever write into a tab that did not exist a moment ago. If Cmd-T does
# nothing, the frontmost tab is whatever the user is working in - very possibly
# the agent session running this script - and typing a command into it would
# hijack their session. Counting tabs first makes that impossible.
codex_cost_result=$(osascript <<APPLESCRIPT 2>&1
tell application "Terminal"
  activate
  if (count of windows) is 0 then return "ERROR:no-window"
  set codexCostWindowsBefore to count of windows
  set codexCostTabsBefore to count of tabs of front window
end tell
delay 0.3
tell application "System Events" to tell process "Terminal" to keystroke "t" using command down
-- Terminal spawns a window instead of reusing a tab whose shell is still
-- starting, so wait for the new tab to settle before writing to it.
delay 1.5
tell application "Terminal"
  if (count of windows) is not codexCostWindowsBefore then return "ERROR:made-window"
  if (count of tabs of front window) is not (codexCostTabsBefore + 1) then return "ERROR:no-new-tab"
  do script "$codex_cost_applescript_command" in selected tab of front window
  delay 0.4
  if (count of windows) is not codexCostWindowsBefore then return "ERROR:spawned-window"
  return "OK"
end tell
APPLESCRIPT
)

case "$codex_cost_result" in
  OK)
    printf '%s\n' 'Codex Cost: opened the dashboard in a new Terminal tab. Press q there to close it.'
    exit 0
    ;;
  ERROR:made-window|ERROR:spawned-window)
    printf '%s\n' 'Codex Cost: Terminal opened a new window instead of a tab, so nothing was run there.' \
      'Close that window. Your current tab was not touched.'
    exit 1
    ;;
  ERROR:no-new-tab)
    printf '%s\n' 'Codex Cost: Terminal did not open a new tab, so nothing was run.' \
      'Nothing was typed into your current tab. Grant Accessibility permission to Terminal in' \
      'System Settings > Privacy & Security > Accessibility, then try again.'
    exit 1
    ;;
  ERROR:no-window)
    printf '%s\n' 'Codex Cost: Terminal has no open window to add a tab to.'
    exit 1
    ;;
esac

printf '%s\n' "Codex Cost: could not open a tab ($codex_cost_result)."
case "$codex_cost_result" in
  *-600*|*-609*|*-1728*|*-2741*|*'Connection invalid'*|*'not running'*|*"Can’t get application"*|*"Can't get application")
    printf '%s\n' \
      'This shell is sandboxed and cannot reach Terminal, so no tab or window is possible from here.' \
      'Start the agent with "codex -s danger-full-access", or press Ctrl+Z and run the launcher yourself:' \
      "  /bin/sh '$codex_cost_launcher'"
    exit 1
    ;;
  *-1719*|*'not allowed'*|*'assistive'*)
    printf '%s\n' 'Grant Accessibility permission to Terminal in System Settings > Privacy & Security > Accessibility, then try again.'
    exit 1
    ;;
esac

printf '%s\n' 'Falling back to a new window.'
open -a Terminal "$codex_cost_launcher"
