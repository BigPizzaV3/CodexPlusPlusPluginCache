# Install And Access

## Contents

- Discover current local endpoint values
- App package and CLI roles
- Install or reuse Vibooks
- Confirm local desktop startup
- Install `vibooks-cli`
- Connection and secret handling
- License and updates

## Discover Current Local Endpoint Values

Treat the local API URL and bind address as discoverable install state, not as a
permanent hardcoded constant.

Use these placeholders below:

- `LOCAL_API_BASE`: the current local Vibooks API base URL reported by
  `vibooks-cli doctor --json`, desktop onboarding, or current install metadata
- `LOCAL_BIND_ADDR`: the matching local bind address for that endpoint when an
  explicit desktop local-start command needs one

Do not assume the default host or port is fixed across releases. Discover the
current values first, then reuse them consistently.

## Use The App Package And CLI Together

Use the official Vibooks application package to deliver, install, start, stop,
update, and uninstall Vibooks. Use `vibooks-cli` and the official Vibooks HTTP
API for bookkeeping, verification, token enrollment, and self-description.

- use the desktop or headless product package for install, launch, restart,
  update, and clean removal
- use `vibooks-cli` for discovery, authentication, book bootstrap,
  bookkeeping mutations, and verification
- use the desktop UI for visual review, owner-driven setup, and token handoff
  when a person is operating Vibooks
- do not replace the official app package with ad hoc binaries copied from
  another machine

## Install Or Reuse Vibooks

Preferred startup order:

1. ensure Vibooks product is installed
2. ensure `vibooks-cli` is installed
3. start or reuse the installed Vibooks app or headless service
4. if this is a first-run local desktop install, confirm the local launch
   settings in the desktop onboarding UI or run the explicit CLI local-start
   flow below
5. run `vibooks-cli doctor --json`
6. if `health.ok = true` but `authenticated_api_ready = false`, follow the
   first-token rules below
7. inspect the entitlement and trial state before creating the first book:
   - run `vibooks-cli license status --json`
   - if the entitlement is inactive, run
     `vibooks-cli license check-trial-eligibility --json`
   - if eligible, run `vibooks-cli license start-trial --book-country <ISO-COUNTRY>`
   - use the actual two-letter legal country of the intended books; do not
     infer it from the interface language or purchase market
   - if not eligible, run `vibooks-cli license activate --license-key ...` or
     stop and ask the owner to activate the desktop
   - on desktop onboarding, keep the free-trial option enabled when eligible
     and finish setup through the official Vibooks flow
8. only after `doctor` reports authenticated API readiness and the desktop
   entitlement or trial is active, start bookkeeping work

### Company capacity, Payroll places, and existing licenses

Inspect `vibooks-cli license status --json` and the live `/api/entitlements`
operation before creating or editing Companies. A new `quota_subscription_v1`
License carries numeric Company and Book limits only; the licensing service does
not choose or store local Company or Book IDs. Every retained Company and Book
counts, including archived records. Permanent deletion through the guarded Core
workflow is the only action that releases Company or Book capacity.

Most Companies should keep all fiscal years in one primary Book. Use Dimensions
for branches, departments and projects. Create an extra Book only for a named
isolation need such as setup testing, migration validation or a retained
predecessor, after discovery confirms shared Book capacity remains. If a restore
or reduction leaves the workspace over capacity, ordinary writes remain blocked
until the owner backs up as needed and permanently deletes enough archived
resources. Never delete accounting history or alter local state merely to make a
requested operation pass.

Only enable native Payroll for a supported Canadian Company after the owner
explicitly chooses to spend a purchased Canadian Payroll place. Inspect the
discovered allocation operation for
`POST /v1/companies/{company_id}/payroll-allocations`, use a stable
`Idempotency-Key`, and send the canonical `CA` jurisdiction. A successful enable
is fixed for that paid period before any new calculation or pay statement can be
returned. Archiving or deleting the Company does not release it. If a restored
workspace has more current-period Payroll allocations than its License permits,
follow the returned billing/support recovery actions; do not try to move or
clear an allocation locally.

Native Payroll is optional and requires the exact country module, current-period
allocation, matching Company country and statutory readiness. Standard
bookkeeping can still record payroll results supplied by an accountant or
external payroll provider; that accounting workflow does not authorize Vibooks
calculation, employee pay-statement generation or another country's native
Payroll.

An existing `company_subscription_v1` License keeps its shipped server-assigned
Company semantics until its stated expiry or an explicitly confirmed successor.
Use its legacy assignment operation only when the live entitlement reports that
exact contract. Never send local Company IDs to new quota-subscription billing
operations.

If capacity, payment, compatibility or renewal action is needed, direct the owner
to the app's License settings and subscription management. Show the actual server
state; do not infer billing tasks from a failed network request. An existing
license keeps its original meaning until an explicit migration. Do not replace
its license key, restart a trial, purchase another subscription, or authorize a
charge merely to repair an upgrade. Subscription changes require the owner's
review of the server-provided quantities, price and effective date.

New trials include bookkeeping and externally supplied Payroll-result
accounting. They do not include native Payroll calculation or generated employee
pay statements. If the service returns `trial_app_update_required`, preserve the
current credential and update the client through the official product flow
before retrying.

Product install detection:

1. if the discovered `LOCAL_API_BASE/api/health` responds, reuse that Vibooks
   instance
2. otherwise check for an existing install:
   - macOS desktop: `/Applications/Vibooks.app`
   - Windows desktop: `%LOCALAPPDATA%/Programs/Vibooks/Vibooks.exe`
   - Linux headless: `vibooks-core` on `PATH` or
     `~/.local/bin/vibooks-core`
3. if Vibooks is missing, install the official product package:
   - macOS:
     `brew install --cask vibooks-ai/tap/vibooks`
   - macOS alternate:
     `curl -fsSL https://vibooks.ai/install.sh | sh`
   - Linux headless:
     `curl -fsSL https://vibooks.ai/install.sh | sh`
   - Windows:
     `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://vibooks.ai/install.ps1 | iex"`
   - on macOS, installation is complete only after `Vibooks.app` exists under
     `/Applications`; launching directly from a mounted `.dmg` is not an
     installed state
4. if Vibooks is installed but not running, start it:
   - macOS: `open -a Vibooks`
   - Windows: launch `Vibooks.exe`
   - Linux headless: if `~/.config/systemd/user/vibooks.service` exists, start
     it with `systemctl --user start vibooks`; otherwise load
     `~/.config/vibooks/vibooks-headless.env` and launch
     `~/.local/bin/vibooks-core`
5. on first-run local desktop installs, do not assume opening the app is enough
   to start listening; Vibooks waits for the confirmed local bind settings
6. only wait for `LOCAL_API_BASE/api/health` after local startup has been
   explicitly confirmed

For a truly clean local desktop reinstall:

1. remove the installed app package
2. remove the desktop app-data directory:
   - macOS: `~/Library/Application Support/ai.vibooks.desktop`
   - Windows desktop: the Vibooks desktop app-data directory for the current
     user
   - Linux headless: `${XDG_DATA_HOME:-~/.local/share}/vibooks` and
     `${XDG_CONFIG_HOME:-~/.config}/vibooks`
3. if the goal also requires a clean CLI or agent credential state, remove the
   saved API-token file too:
   - macOS or Linux: `${XDG_CONFIG_HOME:-~/.config}/vibooks/vibooks-agent.env`
   - Windows: `%APPDATA%/vibooks/vibooks-agent.env`
4. reinstall the official package
5. confirm local desktop startup again through onboarding `Next` or:

   ```bash
   vibooks-cli desktop configure --mode local --bind LOCAL_BIND_ADDR
   vibooks-cli desktop start
   ```

6. rerun `vibooks-cli doctor --json` before starting bookkeeping work

If the agent is given a local macOS `.dmg` file instead of the official install
script:

1. mount the `.dmg`
2. copy `Vibooks.app` from the mounted volume into `/Applications`
3. if `/Applications` is not writable, stop and ask the owner to authorize
   installation there; do not fall back to `~/Applications`
4. unmount the `.dmg`
5. start the installed app from `/Applications/Vibooks.app`
6. do not treat `open /Volumes/<mounted-image>/Vibooks.app` as a persistent
   installation

Use only official Vibooks install and download endpoints. Install entrypoints
such as `install.sh`, `install.ps1`, and `downloads.json` live under
`https://vibooks.ai/`; signed release assets are published under
`https://downloads.vibooks.ai/`. Do not install Vibooks from third-party
mirrors or copied binaries.

## Confirm Local Desktop Startup

For a first-run local desktop install, Vibooks does not auto-start the local API
just because the window opened. The local API starts only after the launch
settings are confirmed.

Two valid ways to do that:

1. human desktop flow:
   - open the Vibooks app
   - keep `Use on this computer` selected
   - confirm the bind address
   - click the onboarding `Next` button
2. agent CLI flow:

   ```bash
   vibooks-cli desktop configure --mode local --bind LOCAL_BIND_ADDR
   vibooks-cli desktop start
   ```

After either flow, wait for `LOCAL_API_BASE/api/health` to become healthy and
rerun `vibooks-cli doctor --json`. The desktop app remains the single
supervisor for the local API; do not run a separate unmanaged `vibooks-core`
alongside it.

## Install `vibooks-cli`

Preferred install order:

1. if `vibooks-cli` is already on `PATH`, reuse it
2. on macOS, prefer Homebrew:
   `brew install vibooks-ai/tap/vibooks-cli`
3. otherwise, install the official standalone CLI binary from the `cli` section
   of `https://vibooks.ai/downloads.json`, which points to the current signed
   binaries under `https://downloads.vibooks.ai/downloads/latest/cli`

Do not use `npx` as the primary install path for `vibooks-cli`.

## Check Whether A Newer Official Build Exists

Treat `https://vibooks.ai/downloads.json` as the source of truth for the latest
official direct-download versions:

- compare `vibooks-cli --version` with `downloads.json` `version.cli`
- compare an installed desktop build with `downloads.json` `version.desktop`
- compare an installed headless bundle with `downloads.json`
  `version.headless`

If the local version is lower than the corresponding `downloads.json` version,
the installed build is old and should be updated before continuing
troubleshooting or new setup work.

If the desktop app still opens, prefer checking its current installed version
from the product's normal update surface. If the desktop app is broken and will
not launch, inspect the installed app or package version from the local bundle
or installer metadata instead of guessing.

Package-manager catalogs can lag the direct-download catalog. Treat
`downloads.json` as the authoritative latest official direct-download version,
not Homebrew, winget, cargo, or third-party mirrors.

## Update To The Current Official Build

When the local install is older than `downloads.json`, update through the same
official channel family:

1. desktop:
   - use only the official Vibooks install entrypoints at
     `https://vibooks.ai/` or the desktop asset URLs published in
     `https://vibooks.ai/downloads.json`
   - do not install copied `.app`, `.dmg`, `.exe`, old local installers,
     third-party mirrors, or unofficial direct URLs
2. CLI:
   - if the user already manages `vibooks-cli` with Homebrew, prefer the
     official `brew` upgrade path
   - otherwise reinstall from the `cli` targets in `downloads.json`
3. headless:
   - reinstall from the official headless target in `downloads.json`

After updating, rerun `vibooks-cli doctor --json` before resuming bookkeeping
work.

## Connection And Secret Handling

Use:

```bash
VCLI='vibooks-cli'
```

Always start with:

```bash
$VCLI doctor --json
```

Agent-execution rule:

- some agent sandboxes or restricted command runners deny or distort loopback
  access to `127.0.0.1`, especially for `vibooks-cli doctor`, `curl`, and
  other HTTP probes
- if localhost checks fail only inside that restricted environment, do not
  conclude Vibooks is broken yet
- rerun the installed `vibooks-cli` from the user's normal shell or through an
  approved unsandboxed command before treating `api_reachable = false`,
  `error sending request for url (...)`, or a fallback from
  `cli_agent_credentials` to `desktop_local` as product evidence
- when the user says `vibooks-cli` was installed with Homebrew, prefer the
  installed Homebrew binary for verification instead of only using a repo-built
  `cargo run` binary

`vibooks-cli` should auto-discover the local API address and token from official
local Vibooks installs. Prefer that default behavior. If it cannot discover a
usable token, stop and follow the first-token rules below. Do not invent a
token and do not fall back to any default token.

### First-Token Rules

1. silent desktop install:
   - install and launch Vibooks from the official desktop package
   - explicitly confirm local desktop startup through onboarding `Next` or the
     `desktop configure` plus `desktop start` flow
   - wait for `LOCAL_API_BASE/api/health`
   - rerun `vibooks-cli doctor --json` for a short retry window; the desktop
     should provision and save a local API token for the current machine user
   - if those localhost checks are being run from a restricted agent sandbox,
     rerun them outside the sandbox before calling it a Vibooks regression
   - if `doctor` reports `token_source = cli_agent_credentials` with
     `invalid API token`, treat that saved token as stale local state; give the
     desktop a short retry window to reprovision it automatically, and remove
     `vibooks-agent.env` only when a fully credential-clean reinstall is
     explicitly required
   - if the local API is healthy but authenticated readiness never appears,
     stop and treat that as a product or setup bug
2. silent Linux headless install:
   - the temporary bootstrap credential lives only in the private service env
     file `${XDG_CONFIG_HOME:-~/.config}/vibooks/vibooks-headless.env`
   - `${XDG_CONFIG_HOME:-~/.config}/vibooks/credentials.json` is metadata-only
     and should point to the headless env path without containing the secret
   - immediately convert that bootstrap credential into a saved API token for
     the agent with `vibooks-cli auth enroll-agent`
3. human-driven desktop initialization:
   - the owner can create an API token from Vibooks `API Tokens` settings or
     from an already authorized local shell with
     `vibooks-cli auth enroll-agent`
   - the owner may let Vibooks save that API token for later CLI
     auto-discovery, or provide the token out of band
   - do not scrape browser session storage, devtools, or internal desktop state
     as a substitute for an approved token handoff

### First-Entitlement Rules

1. after authenticated API access is ready, run
   `vibooks-cli license status --json`
2. if the desktop entitlement is inactive, run
   `vibooks-cli license check-trial-eligibility --json`
3. if trial is eligible, run
   `vibooks-cli license start-trial --book-country <ISO-COUNTRY>`; otherwise run
   `vibooks-cli license activate --license-key ...` or stop and ask the owner
   to activate the desktop
   Use the actual two-letter legal country of the intended books, independently
   of interface language or purchase market.
4. if a local desktop install already has a company or book, do not restart a
   trial blindly; inspect the current entitlement snapshot first
5. never bypass an inactive entitlement by writing directly to storage or by
   replaying hidden internal commands

### Preferred Token Model

1. use auto-discovery only to bootstrap access to a trusted local install
2. create and save one API token for routine work
3. if the current shell will run many `vibooks-cli` commands, export the
   current session environment once from the saved API token and keep using that
   shell session
4. let `vibooks-cli` auto-discover that saved API token in later sessions
5. revoke unused or replaced tokens

Use:

```bash
$VCLI auth enroll-agent --label "Primary agent" --principal-id OWNER_PRINCIPAL_ID
```

For repeated CLI work in the same macOS session:

1. run `vibooks-cli auth export-session`
2. capture that output privately and apply it to the current shell environment
3. do not print the exported token into chat, tickets, screenshots, or logs
4. keep using that same shell session for the rest of the work

Only set `VIBOOKS_BASE_URL` or `VIBOOKS_TOKEN` when:

- connecting to a non-default or remote Vibooks API
- the local install is non-standard and auto-discovery fails
- the user explicitly wants a different endpoint

If a manual override is necessary, export it through the environment:

```bash
export VIBOOKS_BASE_URL=LOCAL_API_BASE
export VIBOOKS_TOKEN=REDACTED
```

Rules:

- never print a token into chat, tickets, logs, or screenshots
- never store secrets in the repo or workspace
- when an explicit loopback address is needed, prefer a numeric loopback host
  over `localhost`
- do not expose the local API on `0.0.0.0` unless the user explicitly asks for
  a remote-access setup
- prefer environment variables over CLI flags for secrets
- do not use or rely on any legacy fixed bootstrap token
- prefer a saved API token over a desktop or headless bootstrap token for
  routine work
- treat local bootstrap credentials as enrollment or control-only; do not use
  them for normal bookkeeping calls when a saved API token is available

Saved API-token storage model:

- macOS and Linux saved-token path:
  `${XDG_CONFIG_HOME:-~/.config}/vibooks/vibooks-agent.env`
- Windows saved-token path: `%APPDATA%/vibooks/vibooks-agent.env`
- desktop-local bootstrap env path:
  - macOS:
    `~/Library/Application Support/ai.vibooks.desktop/desktop/vibooks-bootstrap.env`
  - Windows desktop installs: the desktop app-data directory plus
    `/desktop/vibooks-bootstrap.env`
- Linux headless bootstrap env file:
  `${XDG_CONFIG_HOME:-~/.config}/vibooks/vibooks-headless.env`
- Linux headless metadata file:
  `${XDG_CONFIG_HOME:-~/.config}/vibooks/credentials.json`
- the saved-token file must stay private to the current user: `0600` on
  Unix-like systems, current-user-only ACLs on Windows
- do not place saved API tokens in repo-local `.env` files, shell profiles,
  workspace files, screenshots, or chat transcripts

Treat `vibooks-agent.env` and `vibooks-headless.env` as secret files.
`credentials.json` remains metadata-only for headless discovery.

## License And Updates

Use only official Vibooks licensing and update flows.

- activate or validate licenses only with official Vibooks endpoints
- refresh entitlements only with official Vibooks endpoints
- download updates only from official signed Vibooks assets
- never automate admin licensing endpoints unless the user explicitly has
  authority
