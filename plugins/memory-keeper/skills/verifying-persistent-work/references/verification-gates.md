# Verification gates

A persistent task is complete only when every applicable condition is freshly observed:

- requested durable change exists;
- relevant technical tests passed after the last relevant code/content mutation;
- owning canonical memory matches current truth;
- parent routing/status is correct when parent-level truth changed;
- references/pointers resolve;
- exactly one active canon remains for each owned fact;
- actual persistent storage was directly re-read/re-listed after the last mutation;
- observed final state matches the requested target.

## Evidence authority

Prefer **authoritative evidence** from the storage system that owns the artifact:

1. exact provider-native read/list result for the final Library/cloud item, including returned id/path/name;
2. direct local filesystem read/stat/hash for a local canonical artifact;
3. search/index evidence only for discovery/support.

A **search/index result alone is insufficient** for absence, exact identity, or final completion when direct evidence is available. A write response proves the action was accepted, not necessarily the final persistent state.

## Capability health

No write claim without a real write-capable action; no local temporary artifact presented as Library/cloud persistence; environment limitations stay environment-specific.

## Failure

A failed gate remains failed. Recovery is allowed only within `recovering-persistent-work` budgets; verification cannot reset those budgets or recurse until something eventually passes.
