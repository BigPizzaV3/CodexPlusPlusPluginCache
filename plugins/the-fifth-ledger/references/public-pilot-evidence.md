# Public pilot-evidence boundary

Real-project testing may generate exact evidence that belongs to the adopter, not to
the plugin. Keep the exact report in the adopter's declared private or ignored lane,
or in the authorising task's private deliverables. Bundle only a sanitized summary.

## Sanitized public record

A public record under `tests/pilots/` must include:

- a target class rather than a project or owner identity;
- the authorised action level and mutation boundary;
- generalized five-ledger findings and product friction;
- validation categories and honest unavailable coverage;
- confirmation of where exact evidence was retained;
- the decision state and next gate.

Every record must contain exactly one top-level line with this literal marker:
`Sanitization: public-safe summary; exact adopter evidence retained outside the plugin.`

`Target class` and `Pilot mode` must each be present once with a nonempty value. Outcome,
public-boundary, generalized-findings, product-friction, validation, and decision-closeout
sections must each be present once and contain syntactically visible alphanumeric content
rather than an empty heading. Public pilot records are UTF-8 text: NUL-bearing or invalid
UTF-8 records fail. HTML comments, raw HTML, HTML character references, and fenced code
are unsupported so inert Markdown cannot satisfy required evidence. These rules apply to
the complete `tests/pilots/` subtree, not only its direct children. The machine check
proves this restricted structure; human review still decides whether the visible content
is substantively adequate evidence.

Do not bundle local absolute paths, repository or account identifiers, web links,
commit or asset hashes, private continuity names or contents, raw reports, credentials,
personal identities, project-specific role names, or domain policy. Public information
is not automatically plugin-owned truth.

The dependency-free validator checks the record's required structure and scans regular
source files for common identity-bearing evidence. Outside the public-pilot subtree, a
NUL byte classifies a file as binary; an unreadable source fails validation. Public pilot
records reject every detected absolute POSIX path. The wider source scan rejects
source-tree symlinks plus detected absolute POSIX, macOS-volume, Windows, UNC,
assignment, argument, angle-delimited, local-file-URI, and authority-bearing file-URI
path forms. Human review remains necessary because arbitrary project names and contextual
leakage cannot be detected reliably by pattern matching.
