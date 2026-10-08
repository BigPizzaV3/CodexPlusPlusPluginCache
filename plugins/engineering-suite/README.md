# EngineeringSuite

EngineeringSuite is a skills-only OpenAI plugin intended for the public Plugin Directory. It bundles the complete vendored AI Hero / Matt Pocock, Ponytail, Addy Osmani Agent Skills, and Taste Skill collections plus an explicit router.

## Routing

Use `EngineeringSuite /research ...`, `EngineeringSuite /tdd ...`, `EngineeringSuite /review ...`, `EngineeringSuite /taste ...`, or any exact upstream skill name. Explicit routes invoke the exact installed target skill rather than a rewritten substitute.

## Contents

- 81 vendored upstream skills. Bodies are preserved; six Ponytail `description` frontmatter values are serialized as normalized single-line text for OpenAI Platform compatibility.
- 1 `engineering-suite` router skill.
- Third-party MIT licenses and notices.
- No MCP servers, apps, authentication, or server-side data collection.

## Upstreams

Exact source revisions are recorded in `UPSTREAM_LOCK.json`. This is a community integration and is not endorsed by the upstream authors.
