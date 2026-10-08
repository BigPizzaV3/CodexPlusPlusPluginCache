# Deployment — getting the build live

Match the deploy method to what the project actually is. This is the single
most common failure point in the whole flow.

## Static site → `hosting_deployStaticWebsite`

For pre-built files only: plain HTML/CSS/JS, or the **build output** of a
framework (run the build locally first).

- The archive (zip/tar) must have `index.html` at its **root** — not nested
  inside a folder.
- Name it `name_YYYYMMDD_HHMMSS.zip`; pass `removeArchive: true` to clean up
  after upload.
- The username is resolved from the domain automatically.
- Deployment is effectively immediate — verify right after.

If the project has a `package.json` or needs a build command, this is the wrong
tool. Use the Node.js path instead.

## Node.js app → `hosting_deployJsApplication`

For anything that needs a server or a server-side build: Express, Next.js,
NestJS, SSR frameworks, and also client-side frameworks whose build you want to
run on Hostinger rather than locally.

- Archive the **source**, not the output. Exclude `node_modules/`, `dist/`,
  `.next/`, `build/`, and everything matched by `.gitignore`. The install and
  build run on Hostinger.
- Hard cap: **50 MB** archive.

```bash
zip -r archive.zip . --exclude "node_modules/*" --exclude "dist/*"
```

- The upload starts a build. Track it with `hosting_listJsDeployments`; on
  failure pull `hosting_showJsDeploymentLogs`, fix, and redeploy. Poll with
  backoff — builds take minutes, not seconds.
- `hosting_createNodeJSBuildFromArchiveV1` is the lower-level equivalent with
  explicit overrides (`node_version`, `build_script`, `entry_file`,
  `root_directory`, `package_manager`) and its own log endpoint
  `hosting_getNodeJSBuildLogsV1`. Reach for it only when auto-detection from
  `package.json` gets something wrong.
- `hosting_restartNode_jsApplicationV1` restarts the server process without
  rebuilding — use it after an environment change or to recover a hung app. It
  is a no-op for static front-ends, and returns success either way.

## Migrating an existing WordPress site → `hosting_importWordpressWebsite`

Only when the user wants a WordPress *site* moved in. Takes a site archive plus
a `.sql` dump and can run for several minutes.

Installing WordPress fresh as a content backend is a different flow and a
different skill — see `WORDPRESS.md`.

## Verify — every deploy, no exceptions

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://YOURDOMAIN/
curl -s https://YOURDOMAIN/ | grep -o "SOME_REAL_HEADLINE_TEXT"
```

Replace the grep target with copy you actually rendered. A 200 alone can be a
placeholder page, and a freshly created site serves a default page for a short
while. If the content doesn't match, clear the cache with
`hosting_clearWebsiteCacheV1` and retry before concluding the deploy failed.

When the site is live, report the URL and remind the user it is managed from
hPanel at https://hpanel.hostinger.com.

## After a Node.js deploy

`hosting_listNode_jsVulnerabilitiesV1` reports known npm advisories for the
deployed dependency tree, newest and most severe first. Worth running once the
site is up.

`hosting_patchNode_jsVulnerabilitiesV1` opens a GitHub pull request with updated
versions — it only works for sites deployed from a connected GitHub repository,
returns 404 for archive deploys, and allows one open patch PR at a time. It
changes a repository the user owns, so treat it as a write: confirm first,
naming the repository.
