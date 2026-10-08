# Local runtime setup and unsupported surfaces

This AtReady probe candidate is a Codex-only skills plugin. Its planning and inventory operations
delegate to a separately distributed local `project-atready` runtime. The plugin never
installs, upgrades, or searches broadly for that runtime.

## Supported local setup

The host must be able to run a local Python 3.11 or newer interpreter, the bundled launcher, and an already
installed trusted `uv`. For this plugin candidate, the user may explicitly install or reinstall the
exact reviewed public runtime commit:

```bash
uv tool install --force --no-config --no-python-downloads \
  --default-index https://pypi.org/simple \
  'git+https://github.com/stoicpickle/atready.git@34fb4376b376bb9a26f22578a0b9e1c3aef9cc6e'
```

This pins AtReady's source to the reviewed runtime `0.1.10` commit. It is not a signed release and
does not pin or attest every third-party dependency artifact. The bundled launcher
performs the authoritative compatibility check before every operation. Return to the AtReady
plugin flow and retry there after installation; do not invoke a bare `atready` executable as a
substitute for the bundled launcher. Plugin and runtime product versions may differ; compatibility
requires the same runtime contract version and every feature required by the plugin.
If `UV_INDEX`, `UV_INDEX_URL`, or `UV_EXTRA_INDEX_URL` is set, uv may still use that inherited
index. Clear those variables before running the command when PyPI-only dependency resolution is
required.

If the launcher reports an incompatible runtime, it reports one bounded observed version and the
same public-source command shown above. The user may explicitly run that command, then retry the
AtReady preview or other request in the same task. The launcher re-checks compatibility before any
roster operation.
Its probes do not request roster reads or writes. Never run an install or update command on the
user's behalf, never bypass the launcher, and never weaken its contract or feature checks.

## Unsupported host surface

If the current Codex surface cannot execute the bundled local launcher or cannot access
the user's local inventory, stop before inventory access, preview, routing, or mutation. Explain in
plain language that this AtReady release requires a compatible local runtime and local file
access. You may explain the product or help the user prepare non-sensitive setup steps, but do not
pretend the inventory was loaded, a route was generated, or a write was completed.

Do not ask the user to paste private inventory, private notes, credentials, environment variables,
or account configuration into chat as a workaround.
