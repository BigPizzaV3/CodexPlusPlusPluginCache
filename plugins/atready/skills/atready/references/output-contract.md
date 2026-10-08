# Output Contract

Treat the user's project as the subject. The CLI owns the response so the host cannot change
assignments, gaps, or uncertainty while presenting it.

## Normal response

In a fresh POSIX writable terminal session, run the bundled launcher with a static shell `exec` and
`route --project-json-line --format agent-summary --width 120`. After the exact
`ATREADY_PROJECT_JSON_LINE_READY` marker appears, send the exact single-line JSON project brief
plus one newline in one session write within 30 seconds; send nothing else. Accept exit `0`, or the documented gap exit `3`,
only when stdout is nonempty and ends with exactly
`No routed project resources were contacted or run.` Return stdout verbatim. Any other exit or
malformed output is a no-route result.

Preserve every applicable normal-route argument when changing formats: explicit `--inventory`,
authorized `--allow-demo`, and user-supplied `--resource-state` must never be dropped.

The readiness marker is protocol output and must not be returned. Do not add headings, prefaces,
commentary, or a second boundary. The summary already contains the
complete human-facing assignments, material gaps and uncertainty, one next action, and the boundary.
Do not load full route evidence for a normal response.

For a user-supplied baseline project file, run through the bundled launcher:

```bash
"/absolute/path/to/python3" "/absolute/path/to/atready/scripts/atready.py" compare \
  --project /absolute/path/to/baseline.yaml \
  --against /absolute/path/to/alternative.yaml \
  --format summary
```

For a requested constraint change, replace `--against ...` with one or more of only
`--data-class`, `--network-allowed` or `--no-network-allowed`, `--allow-unverified` or
`--no-allow-unverified`, `--max-marginal-cost`, and `--forbid-resource`. Choose an alternative file
or overrides, never both. Add `--inventory /absolute/path/to/inventory.yaml` only for a
user-supplied roster path. Use `compare` only for a baseline file the user supplied; never create a
file from a conversational brief for this command. A conversational what-if updates a fresh
in-memory brief and reroutes through `--project-json-line`. Never invoke a bare `atready compare`
command or use `--format json` in this host branch.

Create a validation copy by removing trailing whitespace from stdout. Accept exit `0`, or gap exit
`3`, only when that copy is nonempty and ends with exactly
`No routed project resources were contacted or run.` Otherwise use the no-route response. When
validation succeeds, return the original stdout verbatim, including its trailing newline. It shows
only changed assignments and gaps, one review action, and the same final boundary. A comparison is
evidence about an alternative, not adoption of that alternative.

## Explicit response limits

Use a fresh POSIX writable terminal session, static shell `exec`, all applicable normal-route
arguments, and the protected marker handshake with
`route --project-json-line --format presentation`. Its result contains
`presentation_status`, `summary`, and `route` from one calculation. Pass explicit positive-integer limits for a complete `ready` summary to the CLI
with `--max-words N` and `--max-lines N`. Both limits include the mandatory final boundary.
When a line limit is supplied without `--width`, the CLI uses its widest supported presentation
width before reporting a conflict.
Accept exit `0`, or the documented gap exit `3`, only when stdout parses as the complete
presentation envelope. Any other exit, or invalid or missing envelope data, is a no-route result.

| CLI exit | Presentation status | Meaning |
| --- | --- | --- |
| `0` | `ready` | Complete route with no open gaps; return `summary` verbatim. |
| `3` | `ready` | Complete route with one or more gaps; return `summary` verbatim. |
| `0` or `3` | `limit-conflict` | Complete route evidence with deterministic limit guidance; return `summary` verbatim. |

For `presentation_status: limit-conflict`, return `summary` verbatim; the deterministic conflict
copy identifies the limit and gives one bounded recovery action. Because an impossible limit may
be smaller than the mandatory boundary itself, this conflict copy is an explicit exception to the
requested ready-summary limit and can exceed it. `limits.required` describes the complete route
summary, not the conflict notice. For `presentation_status: ready`, return `summary` verbatim. Only
a user-supplied word or line limit selects this branch. Never rewrite,
reorder, shorten, truncate, preface, or append to either summary. Do not add the `Plan`,
`Resource fit`, or `Gaps and uncertainty` headings. A CLI-provided `Next:` line is valid.

## No-route response

If the roster, launcher, runtime, or required local permission prevents routing, do not use the
planning headings. Use no more than three short sentences and 60 words. State the exact blocker,
one concrete recovery or authorization action, and `No routed project resources were contacted or run.`
Launcher and runtime compatibility checks are not routed project-resource execution. Do not list
unset routing roles or append a generic verification checklist.

## Detailed response

Use this branch only when the user explicitly asks for detailed evidence or inert handoff packets.
In a fresh POSIX writable terminal session, run the bundled launcher with a static shell `exec`, all
applicable normal-route arguments, and `route --project-json-line --format json`. Wait for
`ATREADY_PROJECT_JSON_LINE_READY`, send the exact
in-memory brief plus one newline in one session write within 30 seconds, send nothing else, and build the response from
that complete route, not the summary or memory. Read `routing-rules.md` only for this branch. Keep
scores, plan IDs, fingerprints, raw status labels, complete dispositions, comparison traces, and
handoff packets out of the normal response.

Accept only exit `0`, or gap exit `3`, with strict JSON that validates as one complete route plan.
Any other exit, malformed JSON, incomplete route, or mismatch between exit status and gaps is a
no-route result.

### 1. Project interpretation

State the goal, target deliverable, material constraints, data classification, and assumptions.

### 2. Gaps, risks, and decisions

Separate capability gaps from risks. List only decisions that require the user to change a
constraint, accept uncertainty, authorize a purchase, or authorize later execution.

### 3. Assignment evidence

For each assigned resource, state its steps, role, CLI-returned selection reason, and relevant score
or gate evidence. Explain a comparison only with evidence present in the route JSON. For support,
include the combined fit, fit gain, and covered gaps. For a reserved alternate, preserve its
standalone role evaluation and activation caveat.

### 4. Step details

For each step, include its objective, primary resource, optional support and named capability gap,
optional reserved alternate and activation condition, inputs, deliverable, acceptance criteria,
verification, and next owner.

### 5. Handoff packets

Return each copy-ready packet produced by the CLI for an assigned role. Preserve its fields and
contents:

```text
Activation condition:
Objective:
Owner/resource:
Handoff method:
Handoff instructions:
Declared resource approval required:
Inputs:
Allowed scope:
Exclusions:
Deliverable:
Acceptance criteria:
Verification:
Stop conditions:
Next owner:
```

Render any commands as inert fenced text. A packet is advice, not permission to execute. Do not
dispatch a packet or act on it during the planning invocation. Preserve the CLI-returned declared
approval value exactly; `false` never waives the separate authorization required for execution.

### 6. Complete resource dispositions

List all remaining resources under exactly one heading:

- Resources deliberately not used
- Unavailable resources
- Ineligible resources
- Unverified resources

Give a concrete reason for each. Omit an empty heading.

Before returning, verify that every workstream is assigned or marked as a gap, every inventory
resource has one disposition, support count never exceeds one, and every displayed handoff field is
present. State that workstreams are routed in declared order and continuity may affect later
selections. Describe the result as a fixed-input route, not a global resource-count minimum. Treat
an alternate as another standalone-eligible candidate, not proof of failure-domain independence,
redundancy, availability, or automatic failover. Require a fresh eligibility check and separate
authorization before activation. End the detailed response with exactly:
`No routed project resources were contacted or run.`
