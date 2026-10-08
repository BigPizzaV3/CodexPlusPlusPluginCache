# Day-two operations — PHP, databases, cron, caching, subdomains

Everything here is keyed on the account `username` plus the site `domain`, both
of which come from `hosting_listWebsitesV1`. Read the current state and show it
to the user before changing anything.

## PHP

`hosting_getPHPDetailsV1` returns the full picture in one call: current version,
available versions, every extension and its state, every option with its value,
default, type and the plan limit (`max`), and which extension groups conflict.
Run it before any PHP change and show the user the part you intend to touch.

- `hosting_updatePHPVersionV1` — switch version. Only offer versions the details
  call listed as supported.
- `hosting_updatePHPExtensionsV1` — takes `enable` and `disable` arrays. Check
  the conflicting-group data first; enabling two members of a conflict group
  fails or silently drops one.
- `hosting_updatePHPOptionsV1` — send only the options you are changing. Values
  above the plan limit are **silently capped**, so the call can succeed with a
  smaller value than requested. Always re-read `hosting_getPHPDetailsV1`
  afterwards and report the applied value, not the requested one.
- `hosting_resetPHPExtensionsV1` — restores defaults. Destructive to the current
  configuration; show what will be lost first.
- `hosting_getPHPInfoV1` — the full `phpinfo()` HTML, for debugging. Large;
  summarise rather than dumping it into the conversation.

## Databases

- `hosting_listAccountDatabasesV1` — paginated, filterable by `domain` and
  `is_assigned`. The **full name** it returns is what every other database tool
  expects; the short name the user typed will not work.
- `hosting_createAccountDatabaseV1` — name and user get the account prefix added
  automatically when omitted. Requires `website_domain`.
- `hosting_changeDatabasePasswordV1` — breaking, not destructive: any site
  config still holding the old password stops working immediately. Say that
  before running it, and remind the user to update `wp-config.php` or the app's
  environment afterwards.
- `hosting_repairDatabaseV1` — asynchronous repair of corrupted tables. Use it
  when the user reports database errors or crashes.
- `hosting_getPhpMyAdminLinkV1` — a direct sign-on link. Hand it over when the
  user needs SQL, imports, exports, or table management; that is faster than
  driving it through tools.

Remote access is a security decision, not a convenience one:
`hosting_createDatabaseRemoteConnectionV1` takes an IPv4/IPv6 address or `%`.
**`%` allows any host on the internet to attempt a connection.** If the user
asks for `%`, say what it means and offer their current IP instead. List with
`hosting_listDatabaseRemoteConnectionsV1`, revoke with
`hosting_deleteDatabaseRemoteConnectionV1` using the exact `ip` string returned
by the list call.

## Cron

- `hosting_listAccountCronJobsV1` — schedule and command for each job.
- `hosting_createAccountCronJobV1` — takes a cron expression and a command.
  Echo the schedule back in words ("daily at 02:00") before confirming; a
  misread expression is easy to approve and hard to notice.
- `hosting_getCronJobOutputV1` — output of the last run, keyed on the job `uid`
  from the list call. First stop when a user says a cron job "isn't working".
- `hosting_deleteAccountCronJobV1` — by `uid`.

## Caching

- `hosting_clearWebsiteCacheV1` — one-shot purge, including the Hostinger CDN
  when enabled. Pass `directory` for a WordPress install in a subdirectory.
  This is the right answer to "I updated the site but still see the old
  version", and the first thing to try before debugging a deploy.
- `hosting_toggleWebsiteCacheV1` — server-side caching on or off. Leave it on
  for production.
- `hosting_toggleCachelessModeV1` — development mode: nothing is cached at all.
  Correct while actively developing or debugging; remind the user to turn it
  off afterwards, because leaving it on quietly costs them performance.

## Subdomains and parked domains

- Subdomains: `hosting_listWebsiteSubdomainsV1`,
  `hosting_createWebsiteSubdomainV1` (optional `directory`, or
  `is_using_public_directory` to share the parent's root),
  `hosting_deleteWebsiteSubdomainV1`.
- Parked domains serve the same content as the parent:
  `hosting_listWebsiteParkedDomainsV1`, `hosting_createWebsiteParkedDomainV1`,
  `hosting_deleteWebsiteParkedDomainV1`.

Neither can be removed with `hosting_deleteWebsiteV1` — that tool only accepts
main and addon domain websites, and returns 404 for anything else.
