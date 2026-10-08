# The 5th Ledger

The 5th Ledger helps people and coding agents keep consequential project work
truthful, reviewable, and within authority. It asks five practical questions:

1. **Authority** — who may decide or change this?
2. **Canon** — which source owns the truth?
3. **Evidence** — what proves the claim for the exact current state?
4. **Surfaces** — which code, documentation, UI, and records must agree?
5. **Lifecycle** — what has actually been proposed, implemented, validated, published,
   deployed, or released?

The plugin provides focused workflows, review structure, and reusable templates. It
does not replace repository permissions, branch protection, CI, security controls,
release approval, or a project's own accepted sources of truth.

`The 5th Ledger` is the customer-facing display name. The stable technical plugin slug
remains `the-fifth-ledger`.

## Status

Version `0.1.0` is a skills-only candidate-source packet until one exact committed
archive passes validation. Candidate identity, private installation, Platform draft
creation, review submission, approval, and directory publication remain separate
lifecycle facts. Do not infer public availability from this source tree or its version.

The plugin has no MCP server, hooks, apps, external connectors, authentication,
telemetry, UI, hosted/background runtime, or publisher-operated network service. A
host agent may still use user-authorized local commands, Git, or provider reads under
the user's and project's existing permissions.

The distributed candidate is licensed under [Apache-2.0](LICENSE). Non-sensitive
support uses the public project home at
https://github.com/senyo888/the-fifth-ledger/issues. Security reports use its private
vulnerability route at
https://github.com/senyo888/the-fifth-ledger/security/advisories/new.

## How it helps

- Establish the exact target, authority, privacy lane, and stop conditions before work.
- Route to project-owned truth without copying it into the plugin.
- Review claims across authority, canon, evidence, surfaces, and lifecycle.
- Obtain genuinely separate review contexts when risk justifies them.
- Keep proposals, implementation, validation, publication, deployment, and release
  distinct.
- Humanise project-controlled content without softening safety, degraded states, or
  unsupported lifecycle truth.

## Start with the outcome

| Need | Workflow |
| --- | --- |
| Bound a task safely | [`establish-governance-boundary`](skills/establish-governance-boundary/SKILL.md) |
| Adopt the smallest useful profile | [`adopt-fifth-ledger`](skills/adopt-fifth-ledger/SKILL.md) |
| Find truth drift | [`review-project-coherence`](skills/review-project-coherence/SKILL.md) |
| Run separate-context review | [`run-independent-review`](skills/run-independent-review/SKILL.md) |
| Draft or close a durable decision | [`draft-governed-proposal`](skills/draft-governed-proposal/SKILL.md) and [`close-governance-decision`](skills/close-governance-decision/SKILL.md) |
| Assess release evidence | [`review-release-evidence`](skills/review-release-evidence/SKILL.md) |
| Align human-facing content | [`harmonize-project-content`](skills/harmonize-project-content/SKILL.md) |

## Project-owned truth

The plugin carries the governance mechanism, never an adopter's truth. Existing
project contracts retain precedence. A project profile may route canonical sources,
protected invariants, evidence requirements, public/private lanes, and release gates,
but it cannot make those sources true or grant authority.

`routed_paths` is a flat reachability list, not a topic-to-owner or precedence map. If
the project does not already define which source owns a material topic, record the
Canon gap instead of implying that a route resolved it.

Profiles may be `tracked-public`, `ignored-local`, or `external-private`. Placement is
structural evidence, not proof of privacy. The validator checks the closed TOML schema,
concrete routes, authority-state structure, and declared placement; it does not prove
the routed content, a named person's identity, access control, publication, deployment,
or release state.

The complete fail-closed profile, placement, authority, non-Git observation, and
index-byte rules live in the
[project profile and evidence contract](references/project-profile-contract.md).

## Included guidance

- [Five-ledger model](references/five-ledger-model.md) — reusable terminology.
- [Review lenses](references/review-lenses.md) — responsibilities and independence.
- [Public pilot boundary](references/public-pilot-evidence.md) — sanitization rules.
- [Untrusted evidence boundary](references/untrusted-evidence.md) — indirect-injection
  and data-minimization rules applied by every workflow.

Repository architecture, tests, build tooling, and private release evidence are
intentionally not part of the installed package. Their absence is not degraded plugin
behavior; publication evidence remains an external lifecycle record.

## Trust boundary

This is procedural governance, not a hard enforcement boundary. A skill can require
evidence and stop when authority is missing; it cannot substitute for external access
control or prove its own compliance. Claims of independent review require genuinely
separate review contexts.
