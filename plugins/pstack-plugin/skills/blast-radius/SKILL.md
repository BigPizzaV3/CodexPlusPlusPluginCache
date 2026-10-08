---
name: blast-radius
description: "Find what a code change could break outside the diff by tracing callers, contracts, shared data, external integrations, lifecycle behavior, and downstream consumers. Use for 'blast radius of X', 'what could this break', risky PR reviews, regression analysis, and checking whether a small change is actually isolated."
---

# Blast radius

Find what a change could break somewhere else.

Do not stop at the diff or a list of direct callers. The useful part is finding effects that are separated from the changed code by data, timing, configuration, persistence, events, or another system.

Use this skill for questions like:

* "What could this break?"
* "What's the blast radius of this PR?"
* "Is this change actually isolated?"
* "What else depends on this?"
* "Could this cause a regression elsewhere?"
* "Review this small diff. I don't trust it."

Use `how` when you first need to understand the behavior being changed.

Use `why` when an odd constraint or workaround may exist for a historical reason.

## Read the change first

Inspect the actual change when it is available.

That may be:

* a PR
* a diff
* a commit
* a patch
* changed files supplied by the user
* a proposed change described in the conversation

Work out what behavior changes, not just which lines change.

Identify:

* symbols added
* symbols changed
* symbols deleted
* types whose shape changed
* persisted data that changed
* messages or API contracts that changed
* configuration that changed
* lifecycle or ordering changes
* behavior removed implicitly

A ten-line diff can change a contract used by the whole system.

A hundred-line internal refactor may change nothing outside one module.

Judge the behavior, not the size.

## Find the safety fact

Most changes depend on a small number of facts being true.

Find them.

For example:

```text
This is safe only if every caller already handles a missing value.
```

Or:

```text
This is safe only if this field is never read after the session closes.
```

Or:

```text
This is safe only if no other service consumes this JSON field.
```

Or:

```text
This is safe only if duplicate delivery is already handled downstream.
```

Write the safety fact plainly.

If several independent facts must all hold, list them separately.

Do not bury them inside a long risk report.

## Check the obvious references

Find direct dependencies first.

Look for:

* callers
* imports
* implementations
* interface consumers
* subclasses
* tests
* configuration references
* constructors
* dependency injection wiring

This establishes the immediate scope.

It does not establish the whole blast radius.

## Look where symbol search stops

Many regressions happen through relationships that do not share a symbol name.

Trace the changed behavior through the system.

Check for these when relevant.

### Data

Follow data that crosses a boundary.

Look for:

* JSON properties
* database columns
* serialized types
* cache keys
* files
* generated code
* environment variables
* configuration keys
* message payloads
* shared schemas

A field rename can break code in another service that never imports the changed module.

### Persistence

If stored data changes, check who reads old and new records.

Ask:

* Can old records still be loaded?
* Can new code read data written by the previous version?
* Can the previous version read data written by the new version?
* Does a migration need to happen before deployment?
* Are defaults different for existing rows?
* Does a derived value now mean something different?

Treat compatibility across deployments as part of the change.

### APIs and messages

Check consumers of:

* HTTP requests
* HTTP responses
* webhooks
* events
* queues
* topics
* RPC calls
* command payloads
* file formats

Look beyond the repository when the contract crosses repository boundaries.

Do not assume an API is private because there are no callers in the current repo.

### Lifecycle and timing

A change can preserve the same types and still change behavior through timing.

Check:

* initialization
* cleanup
* mount and unmount
* connection setup
* retries
* timeouts
* asynchronous callbacks
* event ordering
* transaction boundaries
* shutdown
* background jobs
* concurrent access

Ask whether something now happens earlier, later, more often, less often, or more than once.

### Shared state

Find state read or written by more than one part of the system.

Look for:

* database rows
* cache entries
* files
* global state
* shared objects
* branches or versioned state
* distributed locks
* counters
* queues

A local-looking write may change behavior far away.

Apply `principle-separate-before-serializing-shared-state` when concurrent writers are involved.

### Configuration

Check whether the path changes according to:

* feature flags
* tenant settings
* environment
* deployment mode
* product tier
* runtime configuration
* platform
* version

A path that looks dead in one configuration may be active in another.

### External libraries

If safety depends on library behavior, inspect the version the project actually uses.

Do not rely on memory of how the library usually behaves.

Check:

* the pinned version
* the library documentation for that version
* source when available
* local wrappers
* patches
* version-specific behavior

Treat library behavior you cannot verify as an assumption.

## Follow effects downstream

Do not stop when the changed function returns.

Ask what happens to its result.

Trace:

```text
change
-> caller
-> state change
-> serialized data
-> downstream consumer
-> user-visible effect
```

The important regression may be several steps away from the changed line.

For event-driven systems, follow the event to its consumers.

For UI changes, follow state through rendering and cleanup.

For persistence changes, follow the stored value to later reads.

For APIs, follow the response or request into its consumer when that source is available.

## Check deletion carefully

Removed code deserves its own search.

When a symbol, field, endpoint, branch, or behavior disappears, look for:

* direct references
* dynamic references
* serialized names
* configuration
* documentation that drives external clients
* tests
* migrations
* scripts
* another repository
* operational tooling

A search that finds no direct references is useful evidence.

It is not proof that no external consumer exists.

## Rate each real risk

Do not return a page of hypothetical failures.

Keep risks that have a credible path from the change to a failure.

For each risk, state:

* what breaks
* how the change reaches it
* the evidence
* likelihood
* impact
* what would prove or disprove it

Use simple likelihood labels:

* low
* medium
* high

Use simple impact labels:

* low
* medium
* high

Do not invent numeric probabilities without data.

## Separate risks from cleared concerns

A concern you investigated and disproved is useful.

Put it under `Cleared`.

For example:

```text
Cleared

Older sessions can still be loaded. The new field has a default and the
deserializer accepts records where the field is absent.
```

This prevents someone else from repeating the same investigation.

Do not leave cleared concerns mixed into the active risk list.

## Evidence levels

Say how strongly each important safety fact has been checked.

Use these levels.

### 1. Assumption

The claim sounds plausible but has not been verified in the available source.

Do not call the change safe based on this.

### 2. Source evidence

Concrete code, documentation, configuration, or contract supports the claim.

Cite the source.

### 3. Path traced

You followed the relevant behavior through its callers, state changes, boundaries, or consumers and could not reach the failure case.

Explain the path.

### 4. Automated evidence

An existing test, CI result, recorded reproduction, or other executable evidence directly exercises the safety fact.

Inspect the test or result before relying on it.

A passing build is not enough when the relevant behavior is not tested.

### 5. Runtime evidence

A recorded runtime reproduction, production observation, integration result, or equivalent evidence demonstrates the behavior in the real system.

Use this only when that evidence is actually available.

Do not claim a higher level than the evidence supports.

## Do not pretend ChatGPT ran the code

This skill may be used in a chat where code execution is unavailable.

Never say:

* "I tested this"
* "I reproduced this"
* "This passes"
* "I verified this at runtime"

unless an available tool actually produced that evidence.

Existing CI or test results may count as evidence when you can inspect what ran and whether it covers the claim.

If the safety fact needs execution and you cannot execute it, mark it:

```text
Unproven
```

Then give the smallest test or reproduction that would settle it.

For example:

```text
Unproven: whether duplicate delivery can create two payments.

Test before merge:
deliver the same payment event twice with the same event ID and assert that
only one payment record exists.
```

That is better than pretending static analysis settled a runtime question.

## Review the test coverage that matters

Do not ask whether the project "has tests."

Find whether a test covers the exact safety fact.

A useful test should fail if your concern is real.

If changing the risky behavior would leave the test green, that test does not prove the behavior.

When existing tests do not cover the risk, describe the smallest useful test.

Do not demand broad test suites when one focused regression test would settle the question.

## Handle cross-repository changes

When a contract leaves the repository, inspect connected repositories when they are available.

Search for:

* endpoint paths
* event names
* JSON properties
* schema names
* database contracts
* package versions
* protobuf fields
* GraphQL fields
* shared type packages

If you cannot access likely consumers, state the limitation.

Do not write:

```text
No other consumers exist.
```

when all you know is:

```text
No other consumers were found in this repository.
```

## Handle PR reviews

For a PR, inspect more than the patch when the source is available.

Useful evidence includes:

* PR description
* changed files
* review discussion
* linked issues
* relevant commits
* tests changed with the PR
* CI results
* surrounding implementation
* consumers outside the diff

A reviewer who reads only the changed lines sees the author's framing of the change.

Blast-radius review checks whether the rest of the system agrees.

## Output

Keep the report focused.

Use this shape for a meaningful change.

### What changed

Explain the behavioral change in a few sentences.

Include behavior that is easy to miss from the diff.

### Safety facts

State the facts that must hold for the change to be safe.

For each one, give its evidence level.

Example:

```text
Safety fact

All exit attempts already tolerate a missing payment record.

Evidence level: Path traced.

The exit handler treats a missing payment as unpaid and refuses the exit.
Both camera and manual exit paths use the same handler.
```

### Risks

Include only credible risks.

For each one give:

```text
Risk
How it breaks
Evidence
Likelihood
Impact
How to settle it
```

Use prose when that reads better than a template.

### Cleared

List concerns you checked and ruled out.

Say why they are safe.

### Before merge

Give the smallest tests, checks, or reproductions that would settle anything still unproven.

If everything important is already supported by strong evidence, say so instead of inventing more work.

## When the change is small

Do not force the full report onto a tiny diff.

A small answer may be:

```text
This change has one meaningful dependency outside the diff.

The new nullable value reaches `createInvoice`, but that function already
handles absence by skipping invoice creation. I traced both callers and found
no serialized or external use of the field.

The remaining unknown is the mobile client. It consumes the same API but its
repository is not available here, so compatibility with that client is
unproven.
```

That is enough.

## Writing

Apply `unslop` to the answer.

Cite real source.

State what you checked and what remains unknown.

Do not turn possibilities into bugs.

Do not turn absence of evidence into proof of safety.

Do not pad the answer with every caller you found.

Find the few facts the change depends on and test those facts as far as the available evidence allows.

Reply with the blast-radius analysis itself.
