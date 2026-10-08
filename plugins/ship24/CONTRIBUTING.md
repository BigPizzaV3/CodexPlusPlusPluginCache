# Contributing

This repository is maintained by the Ship24 team. Bug reports and suggestions through GitHub issues are
welcome; pull requests are reviewed against the rules below.

## Setup

```bash
pnpm install
pnpm check
```

Node 22 (`.nvmrc`) and pnpm 10 (`packageManager` in `package.json`). If `pnpm` is not on the PATH, every
command works as `npx pnpm@10.34.5 <command>`.

| Script | Purpose |
| --- | --- |
| `pnpm generate` | Render every generated reference file from `spec/` and `data/` |
| `pnpm generate:check` | Fail if a generated file is stale (CI) |
| `pnpm lint` / `pnpm lint:fix` | Biome on `scripts/` |
| `pnpm lint:skills` | Frontmatter, naming, size and link rules for every skill |
| `pnpm validate:skills` | Agent Skills reference validator, when available |
| `pnpm validate:manifests` | JSON validity, schema check, version equality, API key placeholders |
| `pnpm validate:claude` | `claude plugin validate --strict` on the Claude Code manifests, skills and agents |
| `pnpm test` | Unit tests for the OpenAPI renderer |
| `pnpm bump <patch\|minor\|major\|x.y.z>` | Bump the version in `package.json` and every manifest |
| `pnpm check` | Everything CI runs |

## What is generated and what is written by hand

| Path | Origin |
| --- | --- |
| `spec/ship24-tracking-api.yaml` | Vendored from docs.ship24.com by the weekly `spec-drift` workflow. Never edit. |
| `schemas/*.json` | Vendored JSON schemas. Never edit. |
| `data/*.json` | Copied verbatim from the docs.ship24.com tables that the OpenAPI spec does not cover (statuses, error codes, rate limits, courier required fields). Edit when the docs change and note the docs URL in the PR. |
| `skills/*/references/*.md` starting with a `GENERATED` banner | Output of `pnpm generate`. Edit the generator or the inputs, never the file. |
| Everything else under `skills/`, `agents/` | Hand-written. |

## Writing or changing a skill

- One directory per skill under `skills/`, named `ship24-<topic>`; the frontmatter `name` must equal the
  directory name.
- Frontmatter uses only the portable Agent Skills fields: `name`, `description`, `license`, `compatibility`,
  `metadata`, `allowed-tools`. Claude-only fields break other hosts.
- `description` is what the model reads to decide whether to load the skill: state what it does and the exact
  phrases that should trigger it, in the third person, under 1024 characters.
- Body under 500 lines. Large tables go to `references/`, runnable code to `scripts/`, sample payloads to
  `assets/`. Link them with relative paths; `pnpm lint:skills` checks that they resolve.
- Every skill folder must be self-contained: some hosts install skills one folder at a time, so never link
  to a file in another skill. Point to the sibling skill by name instead.
- Every factual statement must trace to one of: a docs.ship24.com page, the OpenAPI spec, the `ship24-node`
  source, or the "Verified in Ship24's code" list below. Nothing else, however plausible. When a fact is
  missing from the docs, say so in the skill rather than inventing a number.
- US English. No marketing language.

### Verified in Ship24's code, pending docs backfill

These facts were verified against Ship24's implementation on 2026-09-09 and are used by the skills. They are
not yet on docs.ship24.com; each has a docs update pending. If the implementation changes, update the skills
and this list in the same PR.

| Fact | Used in |
| --- | --- |
| Outbound webhook requests time out after 15 seconds by default. | `ship24-webhooks`, `ship24-webhook-test`, reviewer agent |
| Failed webhook deliveries get up to 20 attempts in total (the docs say 20 retries); the first retry comes about 12 minutes after the failure, later retries are spaced up to 12 hours apart, so the last attempt happens about six days after the first. | `ship24-webhooks`, `ship24-troubleshooting` |
| `POST /trackers` and `POST /trackers/track` look up existing trackers by `clientTrackerId` when one is sent, otherwise by `trackingNumber`, and reuse one without consuming quota when `shippingDate` (day), `originCountryCode`, `destinationCountryCode`, `destinationPostCode`, `shipmentReference`, `courierName`, `trackingUrl`, `settings.restrictTrackingToCourierCode` and the `courierCode` list match. `tracker_conflict` is returned when the `clientTrackerId` belongs to an active tracker with a different payload, and on `POST /trackers/track` when the `courierCode` list overlaps an existing tracker's list without matching it (`findExistingUserShipment` in the tracker service). | `ship24-integration`, `ship24-troubleshooting`, `ship24-couriers` |
| `isTracked` is `false` once Ship24 has archived the shipment or disabled tracking on it. | `ship24-integration`, `ship24-tracking-statuses`, reviewer agent |
| A `2xx` webhook response whose JSON body contains `success: false` (boolean or string) is treated as a failed delivery and retried. | `ship24-webhooks` |
| HTTP status per error code: `tracker_conflict`, `shipping_date_outdated` and (usually) `tracker_not_updatable` come with `400`, `request_conflict` with `409`, `no_active_subscription` with `422`. The docs list codes and statuses separately. | `ship24-troubleshooting`, `ship24-node-sdk` |

## Releasing

Maintainers only.

1. Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md`.
2. `pnpm bump patch|minor|major`, then `pnpm check`.
3. Commit as `chore: release vX.Y.Z`, tag with `git tag -a vX.Y.Z -m vX.Y.Z` (annotated, so that `git push --follow-tags` pushes it), then `git push --follow-tags`. The `release` workflow
   creates the GitHub Release.

Version lives in `package.json` and is mirrored into every manifest by the bump script; CI fails when they
diverge.
