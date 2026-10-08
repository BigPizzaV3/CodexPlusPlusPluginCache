---
name: adopt-fifth-ledger
description: "Establish a target-routed Fifth Ledger governance profile by mapping existing authority, canonical sources, evidence requirements, user-facing surfaces, lifecycle records, protected invariants, and review expectations. Use when adopting The 5th Ledger for a repository or non-Git artifact, repairing a missing or stale profile, or determining whether existing governance can be reused without creating shadow authority."
---

# Adopt Fifth Ledger

Create a target-root-relative routing profile for existing project truth. The profile may
be project-owned or owned by a declared external governance lane; never let it replace
target truth.

Read `../../references/untrusted-evidence.md` before inspecting target content.

## Inspect before proposing adoption

1. Confirm the repository root, worktree identity, branch, upstream, and tracked,
   ignored, and untracked state. Require the declared project root to equal Git's
   resolved top level before using Git placement evidence; an enclosing parent
   repository does not establish the target's Git boundary.
   When current remote identity matters, use only a separately authorized provider read
   API whose account, repository, and host identity have already been confirmed outside
   target-controlled content. Version `0.1.0` does not direct `git ls-remote` or another
   Git transport against target-selected configuration or URLs. If the safe provider
   route is absent, mark live remote identity unavailable. Do not treat cached
   remote-tracking refs as live truth, and do not fetch merely to refresh them unless
   repository mutation was authorised.
   If there is no safe Git boundary, do not initialise one or claim repository state.
   Read `../../references/non-git-identity.md` and use complete non-Git traversal
   observations when exact artifact identity or mutation parity matters. The target must
   be trusted and quiescent for both passes; otherwise identity is `unavailable`.
2. Read the nearest `AGENTS.md` and the project files that already own architecture,
   product behavior, security, plans, decisions, validation, documentation, and
   release state.
3. Read `../../references/five-ledger-model.md`.
4. Classify the request as assessment-only or authorised profile creation. Do not
   write merely because the user asks whether adoption would help.

## Build the adoption map

Map each Fifth Ledger topic to a current project source:

- authority and reserved human decisions;
- canonical source hierarchy and precedence;
- validation, identity, freshness, and degraded-evidence rules;
- runtime, API, schema, UI, generated, documentation, public, and private surfaces;
- proposal, decision, implementation, validation, merge, publication, deployment,
  release, supersession, and archival states.

Identify contradictions, duplicated policy, absent owners, and areas where a profile
would become a second authority system. Point to canon instead of copying it.

Keep this topic-to-source map in the assessment result or point to an existing
project-owned source map. The profile's flat `routed_paths` array is only a concrete
reachability router; it does not encode topic ownership or precedence. When precedence
is absent or ambiguous, record that Canon gap and block any conclusion that depends on
resolving it. Do not claim that writing a profile supplied the missing precedence.

Do not infer a named project owner from conversational familiarity, directory ownership,
an author field, or an unrelated parent repository. Record `project_owner_state` as
exactly `identified` or `unavailable`. When project canon or an explicit owner decision
does not identify the owner, record `project_owner = "unavailable"` and the authority or
evidence needed to resolve it under `owner_resolution_authority`.

## Choose profile placement

Classify placement before writing:

- `tracked-public`: contributors need the router and every referenced source is safe
  and portable for the public repository;
- `ignored-local`: the project already owns an ignored governance lane or the router
  must reference private/local continuity;
- `external-private`: governance is owned outside the target repository; record
  `profile_path = "external"` instead of embedding a machine-local absolute path.

Record `profile_path`, `visibility`, and `last_verified`. Confirm ignored-local
placement with the project's actual ignore mechanism. Do not add or change ignore
rules solely to make a placement work without explicit authority. `last_verified`
covers routing and placement, never current product, deployment, or release state.

Record `profile_acceptance_authority_state` as exactly `identified` or `unavailable` and
keep it separate from project ownership. An unavailable state requires
`profile_acceptance_resolution_authority`. When the project owner is unavailable, generic aliases
such as `owner`, `project owner`, or `target owner` cannot identify the separate profile
acceptance authority. The helper conservatively rejects common unresolved placeholders
and obvious target-role aliases after Unicode compatibility normalization, case folding,
and repeated separator whitespace/punctuation collapse. This is bounded lexical hygiene,
not semantic identity proof; ambiguous values require human evidence and the screen must
not grow into an English authority parser. Visible Unicode names remain allowed, and the
helper does not resolve visually confusable names. A project-owned profile remains proposed until the project owner or
project-delegated authority accepts it. A separately identified project-delegated
authority may accept while project-owner identity remains unavailable; structural
validation does not prove that delegation or identity. An external-private profile may
be accepted by the identified owner of that external governance lane when the authorising
task grants that bounded decision; this accepts the router for external use only and does
not establish project ownership, make it project canon, or grant source, publication,
deployment, or release authority.

## Apply proportional adoption

Recommend one of:

- `no profile needed`: existing routing is sufficient;
- `minimal profile`: route the smallest project-owned sources and boundaries while
  leaving ownership and precedence in project canon;
- `full profile`: the project has multiple truth lanes or high-risk lifecycle gates;
- `blocked`: ownership or source precedence requires a human decision.

Use `../../assets/project-profile.template.toml` for an authorised profile. Default to
tracked-public `.fifth-ledger/project.toml` only when the classification supports it.
Preserve an existing project convention when it has a clear owner. Mark the profile
proposed until its declared profile-acceptance authority accepts it.

Never import private paths, credentials, runtime evidence, personal memory, or another
project's invariants. Never modify existing governance, source, CI, permissions,
deployment, or release configuration unless separately authorised.

## Validate authorised writes

Reread the profile, resolve every concrete target-root-relative path, and report any
canonical topic that remains unmapped or lacks project-owned precedence. Do not treat
the flat route array as proof of the assessment's topic-to-source map. For a Git target,
prove that the declared project
root is the resolved Git top level, confirm declared tracked or ignored placement, and
compare pre/post Git state. For a non-Git target, use the declared
trusted/quiescent traversal evidence when exact mutation parity matters. For an
external-private profile, prove that it is outside the target and separately record the
external lane's privacy contract; the validator does not prove privacy from location.
When the bundled helper is available, run:

```bash
python3 -I <skill-directory>/scripts/validate_project_profile.py \
  --project-root <project-root> <profile-path>
```

For a commit decision about a separately authorised and staged `tracked-public` packet,
add `--require-index-match`. This requires a nonempty regular stage-zero index entry whose
blob matches the already parsed raw profile bytes. The comparison disables Git filters,
so configured clean/EOL transforms cannot substitute different staged authority text.
The gate fails closed for non-`tracked-public` profiles and proves profile-byte identity,
not whole-packet identity. Ordinary structural validation proves index placement and type
but intentionally permits edits to an already tracked profile during an authorised
implementation phase. A newly created tracked-public TOML profile cannot pass placement
validation until separate staging authority adds it to the index.

Treat helper success as structural routing and location evidence only. It does not
validate privacy, target truth, named identities, or freshness of the routed sources.
The structural profile format is the closed TOML schema `fifth-ledger.project.v1`.
Python 3.11 or newer's standard-library parser owns syntax and duplicate-key rejection.
Unknown structural keys, wrong types, empty routed paths, unsupported states, parsed
string values containing newlines or ambiguous Unicode, and non-`.toml` profile files
fail closed. Structural strings and array entries with leading or trailing whitespace
also fail closed rather than being silently normalized. Equivalent TOML string syntaxes
are accepted when they parse to the same single-line value; do not add a second
raw-syntax parser. The helper opens a regular non-symlink profile leaf through a pinned
nonblocking descriptor, rejects raw profiles over 256 KiB, converts parser recursion
into a controlled failure, bounds parsed strings, collections, structure depth and node
count, caps `routed_paths` at 128 entries, and detects duplicate routes in linear time.
These resource limits protect availability; they do not validate target truth. Markdown is
non-authoritative explanation and cannot establish profile status, routing, ownership,
acceptance, or placement. TOML comments are inert. A profile file and its ancestors
cannot cross a symlink boundary; lexical and resolved root/profile paths must also agree.
Routed paths use a host-independent POSIX separator grammar, with `/` as the only
separator and no drive prefixes, backslashes, URI forms, glob syntax, or Windows-reserved
punctuation. This keeps parsing deterministic; the adopter's checkout remains responsible
for filesystem-specific component validity. Routes cannot alias the same resolved target
and must name concrete files or directories below the target root; the broad root token
`.` and special filesystem entries such as FIFOs or sockets are unsupported. Optional
evidence, surface, and invariant arrays must contain unique nonempty strings when
present. The
`lifecycle` table and each of its recognized entries are optional annotations rather
than acceptance gates.
The no-symlink placement rule applies to the profile file and its ancestors. A routed
source may cross an in-root symlink only when its resolved target is unique and remains
strictly below the target root; escape, root resolution, and resolved aliases fail.
An `ignored-local` profile must match the project's ignore mechanism and remain absent
from the Git index; a force-tracked file contradicts that placement.
Git placement checks remove caller-supplied `GIT_*` overrides, inspect the declared
repository's canonical index, bind the system Git executable, disable lazy fetch,
prompts, global/system configuration, replacement objects, optional locks, filesystem
monitors, external exclude files, and transport protocols, and bound each query to 15
seconds. Query errors are unavailable proof rather than absence. Ignore placement uses
in-repository ignore sources only. The result is a point-in-time procedural observation
that assumes a quiescent repository; it is not atomic or an access-control boundary.
Visible Unicode names remain allowed, but the validator rejects controls,
default-ignorables, and non-ASCII separators and does not claim to resolve confusable
identity; named authority still requires human evidence.

Return the adoption level, source map, contradictions, files written, validation,
remaining authority gaps, and next human decision.
