# Maintenance And Escalation

## Uninstall Cleanly

Use the official app or OS uninstall path. Do not delete random files before
stopping Vibooks cleanly.

First:

1. stop bookkeeping work and finish any required export or backup
2. if the machine is still active, revoke saved API tokens that should no
   longer work
3. quit the desktop app or stop the headless service

If the owner wants to keep data:

- remove only the installed application binaries and launchers
- keep the Vibooks data and config directories in place
- on macOS, remove `/Applications/Vibooks.app`, but keep
  `~/Library/Application Support/ai.vibooks.desktop` and
  `~/.config/vibooks`
- on Windows, uninstall `Vibooks.exe` from Apps & Features or remove
  `%LOCALAPPDATA%/Programs/Vibooks`, but keep `%APPDATA%/ai.vibooks.desktop`
  and `%APPDATA%/vibooks`
- on Linux headless, stop and disable `systemctl --user stop vibooks` and
  `systemctl --user disable vibooks`, remove `~/.local/bin/vibooks-core` and
  `~/.config/systemd/user/vibooks.service`, but keep
  `${XDG_DATA_HOME:-~/.local/share}/vibooks` and
  `${XDG_CONFIG_HOME:-~/.config}/vibooks`

If the owner wants a full uninstall with data removal:

- first confirm that no data, backups, evidence, or tokens need to be retained
- remove the installed application binaries and launchers
- then remove the Vibooks data and config directories for that machine:
  - macOS: `~/Library/Application Support/ai.vibooks.desktop` and
    `~/.config/vibooks`
  - Windows: `%APPDATA%/ai.vibooks.desktop` and `%APPDATA%/vibooks`
  - Linux headless: `${XDG_DATA_HOME:-~/.local/share}/vibooks` and
    `${XDG_CONFIG_HOME:-~/.config}/vibooks`

## Stop And Ask When

- the correct accounting period is unclear
- business and personal spending are mixed
- a transfer might actually be revenue, equity, or a loan
- the counterparty is unknown
- a document conflicts with an existing posting
- a closed period needs to change
- a material or judgment-sensitive posting has no source document and the owner
  has not confirmed how to proceed
- a bank or card statement still does not tie after reasonable investigation
