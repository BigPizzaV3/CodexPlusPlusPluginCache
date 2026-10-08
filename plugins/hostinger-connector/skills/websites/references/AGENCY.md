# Agency Plan websites (h5g)

Binary: **`hostinger-agency-hosting-mcp`**.

Agency Plan is a **separate product** from a regular hosting plan, with its own
parallel tool set. The two are not interchangeable: a regular-hosting tool will
not find an Agency Plan website and vice versa. Establish which one you are on
before touching anything.

```
agency-hosting_listAgencyPlanOrdersV1     → does the account have an Agency Plan?
agency-hosting_listAgencyPlanDomainsV1    → which domains are on it
agency-hosting_getAgencyPlanWebsiteDetailsV1 → one website's configuration
```

If the account has no Agency Plan order, stop and say so rather than falling
back to the regular hosting tools — they operate on a different plan and would
either fail or act on the wrong website.

## Naming trap

Two differently-shaped prefixes live in this one binary:

- `agency-hosting_*` — the management API, the large majority of them
- `agencyHosting_*` — just the two file-upload deploys
  (`agencyHosting_deployNodeStaticWebsite`, `agencyHosting_deployPhpApplication`)

Both are real. The inconsistency is upstream, not a typo to correct.

## Provisioning a website

1. `agency-hosting_listAgencyPlanOrdersV1` — find the order to provision on.
2. `agency-hosting_listAvailableDatacentersForAnAgencyPlanOrderV1` — pick a
   datacenter; the first entry is the best match.
3. `agency-hosting_provisionANewAgencyPlanWebsiteV1` — choose the datacenter and
   stack.
4. **Poll** `agency-hosting_getAgencyPlanWebsiteSetupStatusV1` until setup
   finishes. Provisioning is asynchronous; do not report success off the queued
   response.
5. `agency-hosting_linkDomainToAgencyPlanWebsiteV1` — attach the domain that
   will serve traffic.

`agency-hosting_listRunningAgencyPlanWebsiteProcessesV1` lists active and
recently finished async work — use it when something appears stuck.

## Deploying

- `agencyHosting_deployNodeStaticWebsite` — node-static sites.
- `agencyHosting_deployPhpApplication` — PHP and other non-build stacks.
- `agency-hosting_importAgencyPlanWebsiteFromArchiveV1` — import from an already
  uploaded archive.
- `agency-hosting_buildAgencyPlanWebsiteNodeJSAssetsV1` — build and deploy a
  Node.js app from an uploaded archive.

**Both deploy tools overwrite the website's existing files**, which their own
descriptions warn about. That makes a deploy to a live Agency Plan website a
write with real blast radius: name the website and say what is being replaced
before running it.

- `agency-hosting_clearAgencyPlanWebsiteCacheV1` clears cache for every domain
  on the website, preview domain included. Try it before debugging a deploy that
  looks like it did not land.

## Domains

`agency-hosting_changeAgencyPlanWebsiteDomainV1` changes the primary domain;
`agency-hosting_linkDomainToAgencyPlanWebsiteV1` and
`agency-hosting_unlinkDomainFromAgencyPlanWebsiteV1` attach and detach. Unlinking
stops the website serving traffic on that domain — one confirmation naming the
domain and the website.

Registering or configuring the domain itself is the `domains` skill.

## Databases and users

- `agency-hosting_listAgencyPlanWebsiteDatabasesV1`,
  `agency-hosting_createAgencyPlanWebsiteDatabaseV1` — creating a database also
  creates a dedicated user.
- `agency-hosting_createAgencyPlanWebsiteDatabaseUserV1`,
  `agency-hosting_deleteAgencyPlanWebsiteDatabaseUserV1` — each database supports
  a single user. Deleting one revokes all access through it immediately, so any
  app still holding those credentials breaks.
- `agency-hosting_deleteAgencyPlanWebsiteDatabaseV1` — **permanently deletes the
  database and all its data**, its user included. Two confirmations, never
  batched.

## Cron

`agency-hosting_listAgencyPlanWebsiteCronJobsV1`,
`agency-hosting_createAgencyPlanWebsiteCronJobV1`,
`agency-hosting_deleteAgencyPlanWebsiteCronJobV1` (by uuid). Echo the schedule
back in words before confirming — a misread cron expression is easy to approve
and hard to notice.

## WordPress on an Agency Plan

Separate from the `hostinger-wordpress-mcp` tools, and only these three:

- `agency-hosting_getAgencyPlanWebsiteWordPressSettingsV1` — installed core
  version, LiteSpeed and related settings.
- `agency-hosting_listAvailableWordPressVersionsForAnAgencyPlanWebsiteV1`
- `agency-hosting_changeAgencyPlanWebsiteWordPressCoreVersionV1` — only offer a
  version the list call returned. Changing core on a live site can break plugins
  and themes; confirm, and say a downgrade is not risk-free.

Plugin and theme management is **not** available here. If the user needs it, say
so plainly rather than reaching for the regular WordPress tools.

## Deleting a website

`agency-hosting_deleteAgencyPlanWebsiteV1` deletes the website and schedules
cleanup of its resources. Its own description calls the action irreversible. Two
confirmations in separate turns, the first naming the website and stating that
its files and databases cannot be restored by Hostinger.
