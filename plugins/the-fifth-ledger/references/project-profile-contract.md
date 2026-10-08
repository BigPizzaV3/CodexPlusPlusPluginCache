# Project profile and evidence contract

This reference owns the detailed structural contract summarized in the README. The
validator and tests are the executable checks for this contract. Human-friendly wording
must not soften the fail-closed rules below. Any discrepancy is a Canon gap to resolve,
not permission to choose the more convenient source.

## Profile purpose

Adopters choose a `tracked-public`, `ignored-local`, or `external-private` profile, then
use the bundled template to route canonical sources, protected invariants, evidence
requirements, public/private lanes, and release gates. Existing project contracts retain
precedence. The adoption skill validates concrete routed paths and placement without
pretending to validate the routed truth.

`routed_paths` is a flat reachability list, not a topic-to-owner or precedence map. The
adoption assessment must separately identify which project-owned source governs each
material topic and where conflicts are resolved. If that source map does not already
exist, record the Canon gap; do not imply that a structural profile filled it.

## Non-Git observation

For targets without a safe Git boundary, the governance-boundary skill includes a
no-explicit-write helper that requires a trusted, quiescent target and reports two
matching sequential traversal observations, complete or bounded scope, explicit
exclusions, counts, an observation window, a relocation-stable tree digest, a
mutation-sensitive metadata digest, and optional comparison checks.

`Complete` means no path exclusions, not every filesystem attribute. The helper is
neither an atomic filesystem snapshot nor safe against adversarial concurrent path
replacement. It makes no explicit target write, but file reads may update unrepresented
atime. It does not create repository, publication, deployment, or release provenance.

## Ownership and acceptance

The profile validator requires a closed project-owner state: `identified` or
`unavailable`. Missing ownership records the authority needed to resolve it and is never
inferred from conversation.

Profile-acceptance authority is separate. External-private router acceptance uses its
own closed `identified` or `unavailable` state and does not establish project ownership
or project canon. External location is structural evidence, not proof of privacy; the
external lane's privacy contract remains separate. When the project owner is unavailable,
a generic owner alias cannot identify the profile-acceptance authority; the external lane
must name its distinct authority or record it unavailable.

For a project-owned profile, an explicitly identified project-delegated acceptance
authority may accept while owner identity remains unavailable. The validator checks the
structural distinction but does not prove the delegation or named identity.

The validator conservatively rejects common unresolved placeholders and obvious
target-role aliases after Unicode compatibility normalization, case folding, and
repeated separator whitespace/punctuation collapse. This bounded lexical hygiene is not
a semantic identity parser and must not be treated as proof that any other value names a
real or delegated authority. Ambiguous values require human evidence. Visible Unicode
names remain allowed; the structural check does not resolve visually confusable names.

## Closed TOML structure

Profiles use one closed TOML record with schema `fifth-ledger.project.v1`. Required
top-level keys are `schema`, `status`, `profile_path`, `visibility`, `last_verified`,
`routed_paths`, and `authority`. Unknown structural keys, duplicate keys, wrong types,
empty routes, and unsupported state values fail closed.

Optional evidence, surface, and invariant arrays are typed and, when present, must
contain unique nonempty strings. They cannot create a second authority surface. The
`lifecycle` table and each recognized entry are optional annotations, not acceptance
gates. Comments are inert. Markdown remains ordinary documentation and cannot establish
profile status, routing, ownership, acceptance, or placement.

Structural profiles use the `.toml` extension and Python 3.11 or newer's standard-library
parser. Unicode controls, default-ignorables, non-ASCII separators, and parsed string
values containing newlines remain unsupported in structural values. Equivalent TOML
basic, literal, and multiline string syntax is accepted when the parsed value itself is
single-line; no second raw syntax parser is implied. Parsed structural strings and array
entries must not carry leading or trailing whitespace; the validator rejects rather
than silently normalizes that ambiguity.

The helper treats profile bytes as untrusted input. It opens one regular non-symlink
leaf through a pinned nonblocking descriptor, rejects profiles over 256 KiB before
parsing, converts parser recursion into a controlled failure, and then applies
fail-closed limits to parsed string length, collection size, structure depth, and total
node count. `routed_paths` is capped at 128 entries and duplicate detection is linear.
These availability limits do not broaden the closed schema or prove routed content.

## Paths and symlinks

A profile file and its ancestors cannot cross a symlink boundary; lexical and resolved
root/profile paths must agree. This placement rule is narrower than routed-source
resolution: a routed path may cross an in-root symlink only when its resolved target is
unique and remains strictly below the target root. Escape, project-root resolution, and
resolved aliases fail.

Routed paths use a host-independent POSIX separator grammar: `/` is the only separator.
Drive prefixes, backslashes, URI forms, glob syntax, and Windows-reserved punctuation
are unsupported. This makes parsing deterministic across hosts; it does not guarantee
that every component name is valid on every target filesystem, which remains the
adopter's checkout responsibility. Routes must name concrete files or directories below
the target root. The broad project-root token `.` and special filesystem entries such as
FIFOs or sockets are unsupported.

## Git placement and exact bytes

For `tracked-public`, ordinary structural validation proves a non-ignored, nonempty,
regular stage-zero index entry, not that existing tracked worktree bytes match that
entry. A profile declared `ignored-local` must both match an ignore rule and be absent
from the Git index; force-tracking it is a placement contradiction.

A Git query error is not evidence of absence. Placement validation removes
caller-supplied `GIT_*` overrides, binds the system Git executable, disables lazy fetch,
prompts, global/system configuration, replacement objects, optional locks, filesystem
monitors, external exclude files, and transport protocols, and bounds each query to 15
seconds. It uses the declared repository's canonical index and in-repository ignore
sources, failing closed when ignore or index classification cannot be proved. The result
remains a point-in-time procedural observation that assumes a quiescent repository; it
is not an atomic or access-control boundary.

A newly created tracked-public TOML profile cannot pass placement validation until a
separate staging authority adds it to the index. After the exact reviewed packet is
separately authorised and staged, a commit decision uses `--require-index-match` to hash
the already parsed raw bytes without Git filters and prove that exact byte identity
equals the Git index. The flag fails closed for every other visibility; it is
profile-byte evidence, not whole-packet identity.

## Evidence separation

Evidence bundles keep candidate version, published artifact, provider validation, and
human release decision separate. Real-project pilots are recorded only as sanitized
public summaries. Exact adopter evidence remains in adopter-owned or task-owned private
lanes.
