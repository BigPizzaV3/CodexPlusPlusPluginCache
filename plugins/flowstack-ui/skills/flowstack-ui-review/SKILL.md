---
name: flowstack-ui-review
description: Audit a FLOWSTACK implementation against exact-version package Agent Knowledge, ownership, CSS, Theme, responsive, and accessibility contracts. Use for reviews and diagnostics; do not silently turn the review into implementation.
---

# FLOWSTACK UI Review

Review against package-owned evidence, not remembered component rules.

## Establish exact evidence

Inspect the target dependency graph and lockfile. Use `scripts/resolve-agent-knowledge.mjs` for each FLOWSTACK package and reviewed owner, then read its resolved manifest, zero-failure coverage, package guides, and selected artifacts. Pass an exact `--version` whenever that package is not installed; ranges and implicit locked-version selection are rejected. The resolver accepts installed artifacts or exact matching Agent Tools routes only. If the installed/requested version is unavailable, report that as a blocking finding; never review against latest or current-main guidance.

## Audit ownership

- Ordinary finished UI should use Brick. Flag direct Atom imports unless the scope is explicitly headless or the public Brick contract explicitly requires a lower-layer integration point.
- Confirm each interface job maps to the documented Brick owner before accepting native elements, framework widgets, or application CSS. Preserve legitimate application-owned landmarks and document structures.
- Confirm Colors candidates are reviewed before Theme authoring and Theme artifacts are compatible with the installed Brick contract. When authorized paid Blocks are already copied into the application, review their public Brick ownership without expecting Agent Tools to carry private registry metadata or source.
- Treat supplied Blueprint and application decisions as inputs. Do not expose, infer, or invent private policy, creative direction, content, routes, business rules, state persistence, or analytics.

## Audit implementation

Check selected-owner composition and alternatives; semantics, labels, keyboard, pointer, focus, state, portal, and positioning behavior; CSS entry loading; Theme artifact order; appearance modes; supported recipes/tokens/parts; responsive ownership and containment; and the repository's required unit, type, browser/accessibility, build, and package evidence.

Flag unsupported direct declarations on public Brick hooks when documented props, tokens, parts, or Theme ownership should be used. Flag duplicated responsive or behavioral logic. Load exact related Atom guidance to diagnose behavior without recommending a direct Atom bypass in finished Brick code.

## Findings and gaps

For every finding, cite package/version, owner or guide ID, observed code/evidence, violated public rule, impact, and a scoped correction. For a genuine gap, record the intended job, all searched owners, missing capability, current fallback, proposed owner (`Brick`, `Atom`, `Colors`, `Theme`, `Block`, `Blueprint`, or `application`), and verification needed. Distinguish defects from unavailable guidance and intentional application ownership.
