---
name: hostinger
description: Start here for any task involving the user's Hostinger account — deploying a site, managing hosting and PHP, running WordPress, buying or configuring domains and DNS records, or administering a VPS. This skill connects the Hostinger MCP server, signs the user in, sets the safety rules that every Hostinger action follows, and hands off to the specialist skill that owns the task.
---

# Hostinger — router

You are a coding agent with shell access. This skill gets the session to a
known-good, connected, authenticated state and then routes to a specialist. It
does not perform Hostinger operations itself.

**You do the setup, not the user.** Run the phases below yourself. The user
should only ever have to do two things: restart the app once if servers had to
be added, and click **Allow** in the browser once to sign in. Never hand them a
list of commands to run.

Skip straight to Routing when a Hostinger tool call has already succeeded in
this session.

## Phase 0 — Node

The Hostinger MCP server requires **Node 20 or newer**.

```bash
node -v
```

If that errors or reports below 20, tell the user how to fix it and stop — do
not work around it:

- macOS: `brew install node`, or `nvm install 22 && nvm use 22`
- Linux: `nvm install 22 && nvm use 22`, or the distribution's Node 20+ package
- Windows: `winget install OpenJS.NodeJS.LTS`

## Phase 1 — Is every Hostinger server registered?

Do **not** decide this from the tools the current task happens to need. Check
whether all nine Hostinger servers are registered, by reading the config:

```bash
grep -o 'mcp_servers\.hostinger-[a-z-]*' ~/.codex/config.toml | sort -u
```

The names are `hostinger-hosting`, `hostinger-wordpress`,
`hostinger-agency-hosting`, `hostinger-domains`, `hostinger-dns`,
`hostinger-vps`, `hostinger-ecommerce`, `hostinger-reach`, `hostinger-billing` —
nine at the time of writing, and the package may have added more since. See
*MCP binaries* at the end for how to check.

- **All nine present** → go to Phase 3.
- **Any missing** → Phase 2, and register *every* missing one, not just the one
  this task needs.

Do not substitute shell commands or direct API calls for a missing tool.

## Phase 2 — Register all of them at once

Register the Hostinger MCP servers in the shared Codex MCP configuration. The
ChatGPT desktop app, Codex CLI and the IDE extension all read the same config, so
this is done once per machine.

**Register all nine, in one pass, even when the task needs one.** New servers
are only picked up when the host restarts. Registering just what the immediate
request needs means the user restarts again the next time they ask for something
in a different area — deploy, then domains, then a store, a restart each time.
That is the single worst thing this skill can do to them. One write, one restart,
everything works from then on.

Never tell the user "I added the missing module, restart and ask again" more than
once in the life of a machine. If you find yourself about to, you registered too
narrowly the first time.

**Preferred path — `codex` CLI.** It is often not on `PATH` even when a Codex
host is installed. On macOS the ChatGPT desktop app bundles it at
`/Applications/ChatGPT.app/Contents/Resources/codex`. Look in both places:

```bash
command -v codex || ls /Applications/ChatGPT.app/Contents/Resources/codex
```

If you find it, add every server that Phase 1 reported missing:

```bash
for g in hosting wordpress agency-hosting domains dns vps ecommerce reach billing; do
  codex mcp add "hostinger-$g" \
    --env "USER_AGENT=plugin;codex;openai-plugin;0.1.0" \
    -- npx --package=hostinger-api-mcp@latest "hostinger-$g-mcp"
done
```

`npx --package=` resolves the binary out of the package at launch, so nothing has
to be installed globally. Do not run `npm install -g` and do not escalate with
`sudo`. Adding a server that already exists may error — that is harmless, keep
going with the rest.

`USER_AGENT` is appended to the `User-Agent` header the server sends to the
Hostinger API, and it is how Hostinger attributes traffic to the client it came
from. Set it on every block you create. Keep the value exactly as written above,
and never overwrite a different `USER_AGENT` that another Hostinger client
already put in the config.

**Fallback — edit the config directly.** Only when `codex` cannot be found
anywhere. Prefer the CLI whenever it exists: it makes a surgical edit, while
hand-editing risks damaging a file the user's other tools depend on.

The file is `~/.codex/config.toml` (`%USERPROFILE%\.codex\config.toml` on
Windows). **Back it up first**, and tell the user where the backup is:

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak
```

Then **append only**. These rules are absolute:

- Add a block **only** for a server name that is not already in the file.
- If a `[mcp_servers.hostinger-*]` block already exists, **leave it byte for
  byte alone** — even when it looks different from the example below, has extra
  keys, or seems wrong. Other Hostinger tooling writes keys this skill does not
  know about, such as `enabled` and a `USER_AGENT` used for attribution, and
  dropping them silently breaks things elsewhere.
- Never normalise, reformat, reorder, or re-emit existing blocks to match the
  example. The example is a template for **new** blocks only.
- Never delete a block, and never touch a `[mcp_servers.*]` entry for a
  non-Hostinger server.

```toml
[mcp_servers.hostinger-hosting]
command = "npx"
args = ["--package=hostinger-api-mcp@latest", "hostinger-hosting-mcp"]
enabled = true

[mcp_servers.hostinger-hosting.env]
PATH = "<the value of $PATH in this shell>"
```

**The `env.PATH` line is not optional.** The host spawns MCP servers with a
minimal environment that often does not include the directory holding `node` and
`npx`, so a server registered without it starts and immediately dies with
`npx: command not found`. Read the current `PATH` with `echo $PATH` and write
that literal value in. Setting `env` replaces the inherited environment for that
server rather than extending it, so `PATH` has to be spelled out in full. Every
block you add needs its own `.env` — do not add a server without one.

**Verify the edit did not lose anything.** Before telling the user to restart,
compare the block headers against the backup:

```bash
diff <(grep '^\[mcp_servers' ~/.codex/config.toml.bak) \
     <(grep '^\[mcp_servers' ~/.codex/config.toml)
```

Every line should be an addition. If anything was **removed**, you rewrote
instead of appending: restore with
`cp ~/.codex/config.toml.bak ~/.codex/config.toml`, tell the user plainly what
happened, and use the `codex` CLI instead. Do not attempt the hand-edit a second
time.

**If the host refuses the tool count.** All of them together expose a lot of
tools, and some hosts cap how many they will load. If that happens, do not go
back to registering one at a time — set `enabled = false` on the categories the
user does not need (`hostinger-reach`, `hostinger-billing` and
`hostinger-agency-hosting` are the usual first candidates), leave the blocks in
place, and tell the user which ones you turned off and that flipping one back on
is a config edit plus one restart. This mirrors the category toggles in the
Hostinger Connector.

Verify by reading the file back, or with `codex mcp list` if you have the CLI.

**Then ask for the one restart.** New MCP servers are picked up when the host
starts, not while it is running. Tell the user plainly which servers you added
and that the app needs a restart — in the ChatGPT desktop app, save and select
**Restart**; in the IDE extension, **Restart extension**; in the CLI, start a
new session. Say that after the restart they should repeat their original
request, and that sign-in happens on its own at that point.

Stop here. Do not claim the task is done, and do not try to work around the
missing tools in the meantime.

## Phase 3 — Sign in

Do not run a login command, and do not ask the user for a token. The server
handles OAuth itself: on the first tool call with no valid stored credentials it
opens the Hostinger sign-in page in the browser and waits.

Trigger it with a cheap read-only call — `hosting_listWebsitesV1` is a good one,
and its output you need anyway.

- **It returns data.** Already authenticated, from stored credentials or a
  `HOSTINGER_API_TOKEN` in the environment. Continue.
- **A browser window opens.** Tell the user a Hostinger consent screen has
  opened and to click **Allow**. Then wait — the call completes on its own once
  they do. Nothing else is required of them, and credentials are reused by every
  later session. The OAuth callback lands on localhost, so sign-in must finish
  on this machine.
- **It fails with an auth error and no browser opened.** Report the error
  verbatim and stop. Do not improvise a parallel setup by hand.

Expired credentials are refreshed automatically, and a dead refresh token falls
back to the same browser flow. Either way it is transparent — never pre-empt it
with a manual login step.

## Safety policy — applies to every Hostinger skill

These gates are a product decision, not a suggestion. Follow them even when the
user asks you to hurry, says they already agreed, or calls the confirmation
unnecessary. If the user applies time pressure, say plainly that the gate stays
and continue at the same pace.

**One confirmation before any write.** State the operation, the affected
resource, and the account it belongs to. "Create the subdomain `cms.example.com`
on account `u123456789`?" — not "Shall I proceed?".

**Two confirmations, never batched, for anything destructive or billable.**
Destructive means data that cannot be recovered from Hostinger: deleting a
website, database, WordPress installation, store, marketing contact, VPS
snapshot, DNS zone, or WHOIS profile; resetting DNS records; recreating a VPS.
Billable means anything that charges the user: buying a domain or a VPS, placing
or renewing an order. Also treat **disabling auto-renewal** this way — nothing is
charged, but the service lapses, and for a domain that loss is permanent. For
these:

1. First confirmation states what will be lost or charged, in plain language
   and with the specific resource named. Not "this is destructive" but
   "this permanently deletes the website `example.com` and its databases;
   Hostinger cannot restore them".
2. Second confirmation is a separate turn, after the user has answered the
   first. Never bundle several destructive operations into one approval, and
   never carry an approval forward to a different resource.

**Never purchase anything the user did not explicitly ask for by name.** A
request to "get my site online" does not authorise buying a domain or a plan.
Quote the price, name the item, and get an explicit yes.

**Read before write.** List the current state and show it to the user before
changing it. Most Hostinger tools are keyed on a `username` and a `domain` that
must come from a list call, not from a guess.

## Routing

The six specialists match the six product categories in the Hostinger
Connector, so what the user can toggle there maps one-to-one onto what a skill
can do here.

| The user wants to… | Skill |
| --- | --- |
| Deploy a site; provision hosting; manage PHP, databases, cron, caching, subdomains; install or operate WordPress; Agency Plan websites | `websites` |
| Buy, transfer, lock, or configure a domain; edit DNS records | `domains` |
| See subscriptions, auto-renewal, payment methods, prices; order or renew a product | `subscriptions-and-payments` |
| Manage marketing contacts, groups and segments in Hostinger Reach | `email-marketing` |
| Create a Hostinger store, add products, set shipping, wire a custom storefront | `ecommerce` |
| Create, snapshot, firewall, or recover a VPS | `vps` |

If a request spans two specialists — "deploy this site on a domain I want to
buy" — run them in sequence, applying each one's gates. Do not merge their
confirmations.

Two product areas have **no** skill here: **mailboxes** (creating mail accounts,
forwarders, autoreplies) and **Horizons**. If the user asks for those, say
plainly that this plugin does not cover them and point them at hPanel, rather
than improvising with another binary.

## MCP binaries

Tools reach the agent through scoped MCP servers. Each specialist names the
binaries it needs. All of them ship in the single npm package
`hostinger-api-mcp`, so every binary is reachable through one `npx --package=`
invocation:

| Binary | Used by |
| --- | --- |
| `hostinger-hosting-mcp` | `websites` |
| `hostinger-wordpress-mcp` | `websites` |
| `hostinger-agency-hosting-mcp` | `websites` (Agency Plan only) |
| `hostinger-domains-mcp` | `domains` |
| `hostinger-dns-mcp` | `domains` |
| `hostinger-vps-mcp` | `vps` |
| `hostinger-ecommerce-mcp` | `ecommerce` |
| `hostinger-reach-mcp` | `email-marketing` |
| `hostinger-billing-mcp` | `subscriptions-and-payments` |

This table is for knowing which binary holds a tool, **not** for deciding what to
register — Phase 2 registers all nine together so the user restarts once. Note
that a single skill can span several binaries: `websites` reaches into three and
`domains` needs both of its own, which is another reason not to register
piecemeal.

The unscoped `hostinger-api-mcp` exposes every group at once, including the mail
and Horizons groups no skill here covers. Prefer the scoped binaries: they keep
the tool list small enough for the host to expose in full, and some hosts cap how
many tools they will load.

**Do not treat any list here as closed.** Hostinger ships new tools regularly,
and new product groups occasionally. A tool that exists but is not named in a
skill is still a tool you should use when it fits — the lists are orientation, not
an allowlist. Conversely, a tool named in a skill may have been renamed or
removed; if a call fails because the tool does not exist, say so and adapt rather
than insisting. The authoritative list of binaries is whatever the package ships:

```bash
npm view hostinger-api-mcp bin
```

If that shows a `hostinger-<something>-mcp` this skill does not mention, it is a
product group added after this plugin was written. Register it the same way, tell
the user it exists, and treat the absence of a matching skill as a gap in the
plugin rather than a reason to avoid the product.
