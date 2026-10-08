# WordPress

Binary: **`hostinger-wordpress-mcp`** — every tool named `hosting_*`, despite
living in the WordPress group.

## Cross-binary dependency — read this before starting

This binary manages WordPress *inside* a website that already exists. It cannot
create the website or its subdomain. Two tools you will likely need are in
`hostinger-hosting-mcp` — see `SETUP.md`:

- `hosting_createWebsiteSubdomainV1` — to put WordPress on `cms.<domain>`
- `hosting_createWebsiteV1` — to create the hosting website at all

If only the WordPress binary is loaded, say so plainly and ask the user to load
`hostinger-hosting-mcp` as well, rather than working around it. Migrating an
existing WordPress site in from an archive is also elsewhere — that is
`hosting_importWordpressWebsite`, covered in `DEPLOYMENT.md`.

## Installing WordPress

1. **Check for an existing installation first.**
   `hosting_listWordPressInstallationsV1`, filtered by the site's username or
   domain. Reuse a valid install when the user agrees — never overwrite one
   silently. `hosting_detectWordPressInstallationsV1` finds installs the API
   does not already know about; `hosting_checkIfWordPressInstallationsAreValidV1`
   reports whether a known one is healthy.
2. **Choose where WordPress lives.** Default to a dedicated subdomain such as
   `cms.<domain>`, so the main domain stays free for the frontend. Creating it
   is a `SETUP.md` step (see above).
3. **Install** with `hosting_installWordPressV1`. The call only queues the job —
   **poll** `hosting_listWordPressInstallationsV1` until the installation
   appears, typically one to two minutes. Do not proceed on the queued response.
4. **Hand the owner their editor.** Mint a one-click wp-admin link with
   `hosting_createLoginLinksV1` and show it to the user. Content authoring
   happens in wp-admin; this skill does not seed posts, because there is no
   anonymous write path by design. A fresh install ships with a sample post,
   which is enough to build and verify a frontend against.
5. **Caching**, recommended before finishing: enable the object cache with
   `hosting_toggleMemcachedObjectCacheV1`, and purge with
   `hosting_purgeLiteSpeedCacheV1` after configuration changes.

## WordPress as a headless content backend

Use WordPress when the site has **owner-managed content**: a blog, news,
articles — anything the owner must edit without a developer or a redeploy. For
static copy that rarely changes, bake it into the frontend instead; installing
WordPress for content nobody will edit adds a moving part for nothing.

Two surfaces:

| Surface | Base URL | Auth | Use for |
| --- | --- | --- | --- |
| WP REST API | `https://CMS_DOMAIN/wp-json/wp/v2` | none for published content | frontend reads: posts, pages, media, categories |
| Management | Hostinger tools + wp-admin | authenticated | install, plugins, cache; the owner writes content |

Frontend contract, all paths relative to `/wp-json/wp/v2`:

- **Fetch at runtime, not build time.** Content changes when the owner
  publishes; baking it into a static build defeats the purpose. CORS is open,
  so a client-side fetch on page load works from another domain.
- List posts with `/posts?per_page=10&_embed`. `_embed` inlines featured images
  (`_embedded['wp:featuredmedia'][0].source_url`), authors and terms; without it
  you get IDs needing extra requests.
- Bodies are **rendered HTML**: use `title.rendered`, `content.rendered`,
  `excerpt.rendered` and render them as HTML. Do not treat them as plain text.
- Single post by slug: `/posts?slug=my-post` returns an **array** — take the
  first element. There is no direct slug path.
- Pagination comes from the `X-WP-Total` and `X-WP-TotalPages` response
  headers, not the body.
- Only **published** content is returned anonymously. An empty list is a normal
  state the frontend must render gracefully, not an error.
- Never put credentials in the frontend. Drafts and writes need authentication;
  a public site only needs the anonymous read path.

## Plugins and themes

Read the installed state before changing it: `hosting_listInstalledWordPressPluginsV1`,
`hosting_listInstalledWordPressThemesV1`.

- Install: `hosting_installWordPressPluginsV1`, `hosting_installWordPressThemeV1`
- Activate / deactivate: `hosting_activateWordPressPluginV1`,
  `hosting_deactivateWordPressPluginV1`, `hosting_activateWordPressThemeV1`
- Update: `hosting_updateWordPressPluginsV1`, `hosting_updateWordPressThemesV1`,
  `hosting_updateHostingerWordPressPluginV1`
- Discover: `hosting_searchWordPressPluginsV1`,
  `hosting_listAvailableWordPressPluginsV1`,
  `hosting_listSuggestedWordPressPluginsV1`, `hosting_listWordPressThemesV1`
- Commerce check: `hosting_checkIfWooCommerceIsInstalledV1`. A WooCommerce store
  is a different product from a Hostinger store — if the user wants the latter,
  that is the `ecommerce` skill.

Deploying a plugin or theme you built yourself, from local files, is a deploy —
`hosting_deployWordpressPlugin`, `hosting_deployWordpressTheme` in
`DEPLOYMENT.md`.

## Core, maintenance and caching

- `hosting_showWordPressCoreVersionV1`,
  `hosting_listAvailableWordPressCoreUpdatesV1`, `hosting_updateWordPressCoreV1`
- `hosting_showMaintenanceStatusV1`, `hosting_toggleMaintenanceModeV1` — turning
  maintenance mode **on** takes the public site offline for visitors. Confirm
  before enabling it, and remind the user to turn it off.
- `hosting_showLiteSpeedCacheStatusV1`, `hosting_purgeLiteSpeedCacheV1`
- `hosting_showMemcachedObjectCacheStatusV1`,
  `hosting_toggleMemcachedObjectCacheV1`
- `hosting_showAIOptionStatusV1`, `hosting_setAIOptionStatusV1`

## Destructive and sensitive tools

Two confirmations, never batched:

- `hosting_deleteWordPressInstallationV1` — removes the installation and its
  content. Name the exact domain and installation, and state that Hostinger
  cannot restore it.
- `hosting_uninstallWordPressPluginsV1`, `hosting_uninstallWordPressThemesV1` —
  plugin and theme data (settings, custom post types) usually goes with them.
  A single confirmation naming each item is enough, but list them explicitly
  rather than saying "the selected plugins".

`hosting_getInstallationJWTTokenV1` and `hosting_createLoginLinksV1` mint
credentials that grant wp-admin access. Show them to the user who asked, never
write them into a file in the project, and never include them in a commit, a
deploy archive, or a summary that might be pasted elsewhere.
