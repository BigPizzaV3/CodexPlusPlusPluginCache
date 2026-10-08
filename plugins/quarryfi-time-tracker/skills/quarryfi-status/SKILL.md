---
name: quarryfi-status
description: Check QuarryFi R&D tracking status across all configured company profiles
---

Show the user's QuarryFi tracking status across all configured profiles, plus the currently installed Codex plugin version and whether hooks have fired recently on this machine.

## What to do

1. Read `~/.quarryfi/config.json` without displaying any full `api_key`. If it doesn't exist, tell the user to run setup from the verified source clone in a regular terminal, not in the Codex conversation:
   ```
   cd ~/plugins/quarryfi-time-tracker && bash setup.sh
   ```
   Never ask the user to paste a tracker key into Codex, and never invent a credential.

2. Detect the config format:
   - **Multi-profile** (has `"profiles"` array): iterate each profile.
   - **Legacy** (has top-level `"api_key"`): treat as a single unnamed profile.

3. For each profile, display:
   - Profile name
   - Masked key identifier only (for example, `qf_abcd…1234`)
   - API destination: `https://quarryfi.com` (legacy custom `api_url` values are ignored)
   - Mapped project directories (or "all projects" if empty)
   - Whether the current working directory matches this profile

4. Read the local plugin version:
   - Check `~/plugins/quarryfi-time-tracker/.codex-plugin/plugin.json` first
   - If the plugin is installed elsewhere, read the version from that install's `.codex-plugin/plugin.json`

5. For each profile, query only QuarryFi's production status endpoint. Do not use a configured `api_url` value:
   ```bash
   curl --proto '=https' --tlsv1.2 -s -H "Authorization: Bearer $API_KEY" "https://quarryfi.com/api/status"
   ```
   Keep the key inside the command environment. Do not echo it, include the full value in the response, or write it to the audit log.

6. If the API responds successfully, display per profile:
   - Last heartbeat timestamp
   - Last accepted heartbeat receipt
   - Last authenticated contact
   - Health state
   - Plugin version / runtime channel / hook mode / install revision
   - Last 24 hours tracked minutes
   - Last 7 days tracked minutes
   - Active projects from the last 7 days
   - Recent sessions

7. If the API request fails, fall back to the local audit log instead of stopping.

8. Show audit log summary:
   - Check if `~/.quarryfi/audit.log` exists
   - Show the count of recent entries and last heartbeat timestamp
   - Specifically note whether there is any `hook_fired` entry from the current session/day
   - If the user asks for details, show the last 10 lines of the audit log

9. If any API returns an error, show the HTTP status and suggest verifying the API key.
10. Tell the user the dashboard remains the source of truth for deduped activity blocks and qualification review. Tracker activity is supporting evidence, not a determination of tax-credit eligibility or tax advice.

## Response format

```
QuarryFi R&D Tracking Status
═════════════════════════════

Profile: Acme Corp
  API:       https://quarryfi.com
  Projects:  /Users/me/work/acme-api, /Users/me/work/acme-frontend
  Match:     ✓ (current directory matches)
  Today:     2h 34m
  This week: 12h 15m
  Sessions:  3 today

Profile: Personal Projects
  API:       https://quarryfi.com
  Projects:  all (catch-all)
  Match:     ✗
  Today:     0h 45m
  This week: 3h 20m

─────────────────────────────
Audit log: 142 entries, last heartbeat 2 min ago
Source: Codex CLI
```

Adapt based on actual API response fields. Keep it concise. If the API is unavailable, use the audit log plus the current directory/profile match as the fallback status.
