---
name: websites
description: Use for anything on a Hostinger hosting plan — deploying static sites and Node.js applications, provisioning websites and free subdomains, installing and operating WordPress with its plugins and themes, and managing PHP versions and extensions, MySQL databases, cron jobs, subdomains, parked domains and server-side caching. Also covers Agency Plan websites. Buying or configuring a domain name belongs to domains; a VPS belongs to vps.
---

# Websites

Everything that lives on a hosting plan. This is the largest area in the
product, and it spans **three** MCP binaries:

| Binary | Covers |
| --- | --- |
| `hostinger-hosting-mcp` | plans, websites, deploys, PHP, databases, cron, caching, subdomains |
| `hostinger-wordpress-mcp` | WordPress installs, plugins, themes, core, WP caching |
| `hostinger-agency-hosting-mcp` | Agency Plan (h5g) websites — a separate product with its own tools |

Their tools are all named `hosting_*`, `hosting_*` and
`agency-hosting_*` / `agencyHosting_*` respectively — note that the prefix does
not tell you which binary a tool is in. If a tool you need is missing, the
binary holding it is not loaded; say so rather than working around it.

Run the `hostinger` router first. Its safety gates apply to everything here.

## Pick the right product first

Ask this before anything else, because the tool sets do not overlap:

- **Regular hosting plan** — the common case. `hosting_listWebsitesV1` shows
  these. Everything in `references/SETUP.md`, `DEPLOYMENT.md` and
  `OPERATIONS.md` applies.
- **Agency Plan (h5g)** — a different product with parallel, non-interchangeable
  tools. `agency-hosting_listAgencyPlanOrdersV1` shows whether the account has
  one. See `references/AGENCY.md`. Never mix the two tool sets on one website.

## The shape of a run

1. **Plan check** — a website can only exist on an active hosting plan.
2. **Domain** — free subdomain by default, or verify a domain the user owns.
3. **Create the website** and wait for it to exist.
4. **Deploy** — static or Node.js, chosen by what the project actually is.
5. **Verify** — a 200 plus real page copy, not just a 200.

Steps 1–3 are in `references/SETUP.md`; 4–5 in `references/DEPLOYMENT.md`.
Day-two operations — PHP, databases, cron, caching, subdomains — are in
`references/OPERATIONS.md`. WordPress, including using it as a headless content
backend, is in `references/WORDPRESS.md`. Agency Plan work is in
`references/AGENCY.md`. Read the reference before running the step; the sequences
there encode failure modes that are not obvious from the tool descriptions.

## Things that will bite you

**A free subdomain is not a website.** `hosting_generateAFreeSubdomainV1`
returns a domain; deploying to it before `hosting_createWebsiteV1` fails with
`No website found for domain`. Create, then poll `hosting_listWebsitesV1` until
it appears.

**`username` is not the account email.** Almost every hosting tool is keyed on
the hosting account `username`, which comes from `hosting_listWebsitesV1`. Never
guess it, and never reuse one site's username for another.

**Static and Node.js deploys take opposite archives.**
`hosting_deployStaticWebsite` wants the *build output* with `index.html` at the
archive root. `hosting_deployJsApplication` wants the *source*, with
`node_modules/` and build output excluded, under 50 MB. Sending the wrong one
is the most common failure in this flow.

**Creation and builds are asynchronous.** `hosting_createWebsiteV1` and the
Node.js build both return before the work finishes. Poll with backoff —
websites take minutes, builds take longer. Do not report success off the
queued response.

**Three WordPress-shaped deploy tools are in the hosting binary, not the
WordPress one:** `hosting_importWordpressWebsite`,
`hosting_deployWordpressPlugin`, `hosting_deployWordpressTheme`. They are
file-upload deploys rather than WordPress management. Migrating an existing
WordPress site is a deploy and belongs here; installing WordPress fresh is in
`references/WORDPRESS.md`.

## Destructive tools

Two confirmations, never batched, per the router's policy:

- `hosting_deleteWebsiteV1` — removes the site, its files and its databases.
  Takes an explicit `confirm: true`; that flag is not a substitute for asking
  the user.
- `hosting_deleteAccountDatabaseV1` — drops the database and its remote
  connection rules.
- `hosting_deleteWordPressInstallationV1` — removes the installation and its
  content. Name the exact domain and installation.
- `agency-hosting_deleteAgencyPlanWebsiteV1`,
  `agency-hosting_deleteAgencyPlanWebsiteDatabaseV1` — same weight, see
  `references/AGENCY.md`.

Single confirmation naming the exact resource is enough for the recoverable
ones: `hosting_deleteAccountCronJobV1`, `hosting_deleteWebsiteSubdomainV1`,
`hosting_deleteWebsiteParkedDomainV1`,
`hosting_deleteDatabaseRemoteConnectionV1`,
`hosting_uninstallWordPressPluginsV1`, `hosting_uninstallWordPressThemesV1`,
`hosting_resetPHPExtensionsV1`, `agency-hosting_deleteAgencyPlanWebsiteCronJobV1`,
`agency-hosting_deleteAgencyPlanWebsiteDatabaseUserV1`.

`hosting_changeDatabasePasswordV1` is not destructive but it *is* breaking: any
site config still holding the old password stops working. Say that before
running it.

## Credentials

`hosting_createLoginLinksV1` and `hosting_getInstallationJWTTokenV1` mint
wp-admin access. `hosting_getPhpMyAdminLinkV1` mints database access. Show them
to the user who asked, never write them into a project file, and never include
them in a commit, a deploy archive, or a summary that might be pasted elsewhere.

## Full tool list — `hostinger-hosting-mcp`

Deployment: `hosting_deployStaticWebsite`, `hosting_deployJsApplication`,
`hosting_listJsDeployments`, `hosting_showJsDeploymentLogs`,
`hosting_importWordpressWebsite`, `hosting_deployWordpressPlugin`,
`hosting_deployWordpressTheme`

Node.js builds: `hosting_listNodeJSBuildsV1`,
`hosting_createNodeJSBuildFromArchiveV1`, `hosting_getNodeJSBuildLogsV1`,
`hosting_restartNode_jsApplicationV1`, `hosting_listNode_jsVulnerabilitiesV1`,
`hosting_patchNode_jsVulnerabilitiesV1`

Websites and plans: `hosting_listWebsitesV1`, `hosting_createWebsiteV1`,
`hosting_deleteWebsiteV1`, `hosting_listOrdersV1`,
`hosting_listAvailableDatacentersV1`, `hosting_generateAFreeSubdomainV1`,
`hosting_verifyDomainOwnershipV1`

Subdomains and parked domains: `hosting_listWebsiteSubdomainsV1`,
`hosting_createWebsiteSubdomainV1`, `hosting_deleteWebsiteSubdomainV1`,
`hosting_listWebsiteParkedDomainsV1`, `hosting_createWebsiteParkedDomainV1`,
`hosting_deleteWebsiteParkedDomainV1`

Databases: `hosting_listAccountDatabasesV1`, `hosting_createAccountDatabaseV1`,
`hosting_deleteAccountDatabaseV1`, `hosting_changeDatabasePasswordV1`,
`hosting_repairDatabaseV1`, `hosting_getPhpMyAdminLinkV1`,
`hosting_listDatabaseRemoteConnectionsV1`,
`hosting_createDatabaseRemoteConnectionV1`,
`hosting_deleteDatabaseRemoteConnectionV1`

PHP: `hosting_getPHPDetailsV1`, `hosting_getPHPInfoV1`,
`hosting_updatePHPVersionV1`, `hosting_updatePHPExtensionsV1`,
`hosting_updatePHPOptionsV1`, `hosting_resetPHPExtensionsV1`

Cron: `hosting_listAccountCronJobsV1`, `hosting_createAccountCronJobV1`,
`hosting_deleteAccountCronJobV1`, `hosting_getCronJobOutputV1`

Caching: `hosting_clearWebsiteCacheV1`, `hosting_toggleWebsiteCacheV1`,
`hosting_toggleCachelessModeV1`

The `hostinger-wordpress-mcp` and `hostinger-agency-hosting-mcp` tool lists are
in `references/WORDPRESS.md` and `references/AGENCY.md`.
