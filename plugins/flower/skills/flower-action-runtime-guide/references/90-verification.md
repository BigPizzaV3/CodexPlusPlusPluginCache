# Verification

Run checks in proportion to the changed surface. Prefer deterministic tests and
record any environment-dependent check that could not run.

## Runtime Repository

For a complete source change:

```powershell
mvn -B -ntp clean verify
```

Before a release, also exercise sources, Javadocs, signing configuration, and
Central packaging through the repository's documented release profile. Use its
publishing-skip option for a dry run; never use the real deploy command merely
as a verification step.

For focused iteration, use Maven's project selection with required upstream
modules, then finish with the full reactor. Repeat real concurrency test classes
when changing `RunStore`, completion, cancellation, or recovery.

## Host Application

Run the host's normal complete check, such as:

```powershell
mvn -B -ntp verify
```

or:

```powershell
./gradlew check
```

When Flower Flow, Step, Guard, Worker, or wait code changed, follow
`flower-app-guide` and run the configured `flower-check` and `flower-testkit`
coverage as well.

## Completion Checklist

- Every entry point creates a proposal instead of mutating the domain directly.
- Identity, tenant, run id, and idempotency semantics are explicit.
- Duplicate reservation is scoped by tenant, action, and idempotency key, with
  any required principal/resource visibility boundary.
- The duplicate-policy implementation matches the deployment boundary:
  in-memory only for one JVM with acceptable restart loss, JDBC or another
  shared owner-aware atomic policy for restart/multi-instance coordination.
- JDBC duplicate use applies the matching `action_duplicate` schema through
  host-owned migrations, preserves the first terminal result, and has no
  automatic age-based takeover of uncertain `RUNNING` work.
- Registry, validation, and policy run before duplicate lookup; a denied caller
  cannot receive an existing authorized result.
- When policy has a denied-principal boundary, a named test first caches an
  authorized result, then retries the same tenant, action, idempotency key, and
  resource when applicable as a denied principal and proves denial, zero
  result/protected-data disclosure, and no additional side effect.
- When the action or result is resource-bound, a named test reuses the same
  tenant, action, and idempotency key for resource B with a request otherwise
  valid and authorized for B, and proves that resource A's cached/protected data
  does not cross the boundary.
- N/A is recorded for absent visibility dimensions or intentionally shared
  results; tenant-global/shareable semantics are not rewritten merely to
  satisfy the checklist.
- Approval resume repeats definition, validation, policy, and guard checks.
- Executor mode matches work lifetime, blocking behavior, and durability.
- Deferred callbacks authenticate and verify the current attempt token.
- Deferred dispatch has deterministic operation identity, idempotency,
  reconciliation, timeout, and orphan policy; exactly-once is not assumed.
- All externally visible transitions use durable versioned CAS.
- Real thread/connection races prove one terminal winner. For a stateful
  built-in or custom policy that claims concurrent duplicate suppression and
  caches/finalizes
  reservations, a deterministic full-pipeline reserve-versus-complete race
  goes through the runtime and executor and proves one `ACCEPT`, one executor
  invocation/domain side effect, and an unchanged original result on later
  duplicates; policy-only ABA tests are supplemental.
- Recovery and duplicate delivery are idempotent.
- Native PostgreSQL/MySQL duplicate-policy behavior is supported by the
  opt-in `native-database-tests` profile when that production claim applies;
  mock-only JDBC tests are not native concurrency evidence.
- A host that combines Action Runtime `0.3.3` with Agent `0.2.0` or AI Harness
  `0.1.3` resolves Flower `0.1.3`, records the dependency tree, and tests the
  selected integration path without relabeling host evidence as upstream
  release verification.
- Result codes and retry dispositions are stable and machine-readable.
- Unknown failures do not silently become automatic retries, and unconfirmed
  external cancellation remains visible.
- Full tests, documentation checks, and any release dry run pass.
