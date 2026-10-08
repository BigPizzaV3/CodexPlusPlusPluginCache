# Release Artifact Trust Check

## Operation

Verify the selected source-to-release-to-environment artifact contract without changing release state. Read [supply-chain boundaries](../../../references/supply-chain.md). Upstream exploit remediation belongs to Security; this check establishes what bytes are being promoted and whether they can be recovered safely.

## Required input

The exact source commit, build identity, candidate artifact/digest, required CI and provenance policy, target environment and rollback contract. Identify which publication/promotion/restore checks are authorized and available.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- The checked source/build inputs and approved release contents identify the same candidate artifact.
- The published and promoted bytes match the tested object or have explicit evidence for any rebuild equivalence.
- Checksum integrity, authorized builder/publisher identity and policy-required attestations are independently established.
- Configuration, data/schema/event compatibility and available rollback artifacts preserve the intended recovery path.
- Local assembly, remote publication, deployment and restore evidence are not substituted for one another.

## Establish the chain

Record the source commit/tag, build identity, toolchain and lockfile inputs, required CI results, archive/container digest, published asset identity and target environment. Use exact identifiers rather than a moving branch name or latest tag. Define the repository's provenance/signature/inventory policy before judging missing metadata.

## Artifact checks

- Confirm that required checks ran on the source inputs used to build the candidate, including relevant generated files and dependency state.
- Compare the actual archive/image contents with the approved release inventory. Check unexpected files, sensitive paths, symlinks/path traversal, missing runtime assets and version/manifest disagreement.
- Verify the digest of the candidate and the downloaded published asset. A matching checksum detects changed bytes; it does not by itself prove the authorized builder or publisher.
- Where required, validate signatures/attestations against the expected identity and subject digest. An SBOM is an inventory, not evidence that every listed component was safe or that the build was trusted.
- Confirm the promoted object is the tested object. If the system rebuilds per environment, identify the changed inputs and the evidence needed to establish equivalence rather than assuming it.

## Runtime and recovery checks

Trace deployment configuration to the same immutable artifact and inspect version reporting. Identify mutable configuration, migrations, feature flags and external contracts that may change behavior despite identical application bytes.

Verify that a rollback candidate is available and compatible with the current schema, stored data and events. When rollback cannot be safe, identify the bounded forward-fix or restore plan and the evidence supporting it. Do not trigger a deployment or restore merely to complete an inspection request; use an existing approved test environment or recorded exercise where available.

## Verification method

Use repository-native build, digest, archive and attestation tools. Rebuild only when reproducibility is part of the selected promise; compare actual bytes and report nondeterministic inputs. Use synthetic canaries for exclusion checks and avoid exposing real secret values. Pair failure cases with a valid package so an always-rejecting gate is not considered sufficient.

## Evidence and limitations

Report each link as verified, failed or not exercised with exact identifiers, commands and evidence. Separate local assembly, remote publication, environment promotion and recovery readiness. Tie failures to the owning source and one repair direction; do not infer production readiness solely from a green build or a locally valid ZIP.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
