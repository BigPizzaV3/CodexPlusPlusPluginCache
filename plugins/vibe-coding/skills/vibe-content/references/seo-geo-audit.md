# SEO GEO Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit public discoverability for search engines and generative-answer surfaces: crawlability, metadata, canonical URLs, structured data, content hierarchy, internal links, public trust evidence, performance-sensitive rendering, and regression coverage. Keep only issues with current repo evidence and public-surface impact.

## Inspect

Public routes/pages, route metadata, SSR/SSG/static generation, robots rules, sitemap generation, canonical/hreflang links, redirects, Open Graph/Twitter metadata, schema.org/JSON-LD, headings/content hierarchy, public docs/blog/FAQ/help content, landing copy, pricing/trust/legal pages, image alt text, internal links, analytics/search console hooks when repo-visible, tests/snapshots, and deployment/runtime config that affects public rendering.

## Issue classes

- Crawlability and indexing: important public route blocked by robots/noindex/auth/client-only rendering, sitemap missing/stale, broken canonical, redirect loops, duplicate public URLs, and environment-specific metadata leakage.
- Metadata and snippets: missing/wrong title/description, OG/Twitter drift, weak or false public summaries, missing alt text for meaningful public images, and locale/hreflang inconsistencies.
- Structured data: missing, invalid, duplicated, or misleading JSON-LD/schema where the repo already has suitable public entities such as organization, product, article, FAQ, breadcrumb, software app, or local business.
- Content hierarchy and GEO: public pages lack clear answerable structure, entity definitions, FAQs, source/evidence sections, product capability boundaries, or trust signals needed for extraction by search and answer engines.
- Performance and rendering: public content or metadata depends on slow/failed client fetches, heavy media, or hydration-only rendering when the framework supports safer server/static output.
- Regression resistance: no tests/snapshots for critical metadata, sitemap, canonical, structured data, or public route rendering where repo patterns support them.

## Priority model

Primary public route cannot be indexed or renders materially wrong metadata/content, canonical/noindex blocks acquisition, legal/pricing/trust claim is false, or public content leaks private/internal data.

Important discoverability issue: stale sitemap/canonical/hreflang, missing metadata/structured data on high-value pages, weak answer-extraction structure on core public content, or missing regression coverage for critical metadata.

Lower-risk but concrete public-surface improvement: minor snippet drift, alt/internal-link gap, FAQ/schema opportunity backed by existing content, stale docs, or localized SEO inconsistency.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the public route/content/metadata owner and affected surface, plus symbol when possible.
- Include expected rendered output, public user/search/answer impact, acceptance criteria, and validation direction.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same public route or metadata owner unless fixes, rollout units, locales, or validation differ.
- Do not recommend keyword stuffing, fake claims, hidden text, doorway pages, or generic content rewrites without repo-backed product truth.
