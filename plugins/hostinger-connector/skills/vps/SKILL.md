---
name: vps
description: Use when the user wants to administer a Hostinger VPS — listing and inspecting virtual machines, starting, stopping or restarting them, taking and restoring snapshots and backups, managing firewalls and their rules, SSH public keys, post-install scripts, PTR records, hostnames and nameservers, entering recovery mode, reading metrics and malware scan results, or running Docker projects on the machine.
---

# VPS operations

Binary: **`hostinger-vps-mcp`** — every tool named `VPS_*`.

Run the `hostinger` router first. Its safety gates apply to everything here,
and they matter more on a VPS than anywhere else: this is the one product where
a single tool call can destroy a machine the user cannot rebuild from Hostinger.

## Always start by reading state

`VPS_getVirtualMachinesV1` lists the machines and their IDs; every other tool
is keyed on one. `VPS_getVirtualMachineDetailsV1` gives plan, state, hostname,
template and IP for a single machine. Never act on a machine ID the user typed
without confirming it against the list — VPS IDs are numeric and easy to
transpose.

Asynchronous work returns an action, not a result. `VPS_getActionsV1` and
`VPS_getActionDetailsV1` are how you find out whether the thing actually
happened. Poll them with backoff instead of assuming success.

## The four tools that can lose the user's server

Two confirmations, in separate turns, never batched, per the router's policy.
For each of these, the first confirmation must state in plain language what is
destroyed and that Hostinger cannot bring it back.

- **`VPS_recreateVirtualMachineV1`** — wipes the machine and reinstalls the OS
  from a template. Everything on disk is gone: sites, databases, configuration,
  anything not already in a snapshot or an off-box backup. Before offering it,
  check `VPS_getSnapshotV1` and `VPS_getBackupsV1` and tell the user exactly
  what restore point exists, or that none does.
- **`VPS_deleteSnapshotV1`** — removes the restore point itself. Confirm what
  it was taken from and when.
- **`VPS_restoreSnapshotV1` / `VPS_restoreBackupV1`** — recovery, but also a
  full-disk overwrite: everything written since that point is discarded. Say
  how old the restore point is and what window of work will be lost.
- **`VPS_deleteProjectV1`** — deletes a Docker project and its containers.

`VPS_purchaseNewVirtualMachineV1` charges the user. Two confirmations, price
and term stated, never off an implied request.
`VPS_setupPurchasedVirtualMachineV1` provisions an already-purchased machine —
it is not itself billable, but it does write a root password and a template.

## Power and recovery

- `VPS_startVirtualMachineV1`, `VPS_stopVirtualMachineV1`,
  `VPS_restartVirtualMachineV1` — stopping or restarting takes the user's
  services offline. One confirmation naming the machine and what it hosts.
- `VPS_startRecoveryModeV1` / `VPS_stopRecoveryModeV1` — boots a rescue
  environment. Recovery mode reboots the machine and the normal system is not
  running while it is active; make sure the user understands the downtime, and
  remind them to stop recovery mode afterwards.

## Credentials and access

- `VPS_setRootPasswordV1`, `VPS_setPanelPasswordV1` — show the new password to
  the user in the conversation only. Never write it to a project file, a
  summary, or anything that could be committed or pasted elsewhere. Say plainly
  that changing the root password breaks any automation still using the old one.
- SSH keys: `VPS_getPublicKeysV1`, `VPS_createPublicKeyV1`,
  `VPS_attachPublicKeyV1`, `VPS_getAttachedPublicKeysV1`,
  `VPS_deletePublicKeyV1`. Detaching or deleting the only attached key can lock
  the user out of their own machine — check `VPS_getAttachedPublicKeysV1` and
  warn before removing the last one.

## Firewalls

`VPS_getFirewallListV1` and `VPS_getFirewallDetailsV1` first, always.

- Rules: `VPS_createFirewallRuleV1`, `VPS_updateFirewallRuleV1`,
  `VPS_deleteFirewallRuleV1`.
- Attachment: `VPS_activateFirewallV1`, `VPS_deactivateFirewallV1`,
  `VPS_syncFirewallV1`, `VPS_createNewFirewallV1`, `VPS_deleteFirewallV1`.

Two specific hazards worth naming to the user before acting:

1. **Removing or narrowing an SSH rule can lock them out**, and fixing it needs
   console access. Confirm the source range before touching port 22.
2. **Activating a restrictive firewall on a live machine** can cut off a running
   site or database. Read the ruleset back to the user before activating it.

Opening a port to `0.0.0.0/0` exposes that service to the entire internet. If
the user asks for it, say so and offer a narrower source range instead.

## Snapshots, backups and templates

- `VPS_createSnapshotV1`, `VPS_getSnapshotV1`, `VPS_deleteSnapshotV1`,
  `VPS_restoreSnapshotV1`
- `VPS_getBackupsV1`, `VPS_restoreBackupV1`
- `VPS_getTemplatesV1`, `VPS_getTemplateDetailsV1`

Offer to take a snapshot before any risky operation. It is the cheapest
insurance available and turns most VPS mistakes into a rollback.

## Networking and identity

- `VPS_setHostnameV1`, `VPS_resetHostnameV1`
- `VPS_setNameserversV1` — resolver configuration on the machine, not the
  domain's registrar nameservers; those are `domains`.
- `VPS_createPTRRecordV1`, `VPS_deletePTRRecordV1` — reverse DNS, which matters
  for outbound mail deliverability. Deleting a PTR record can silently degrade
  it; mention that.
- `VPS_getDataCenterListV1`

## Post-install scripts

`VPS_getPostInstallScriptsV1`, `VPS_getPostInstallScriptV1`,
`VPS_createPostInstallScriptV1`, `VPS_updatePostInstallScriptV1`,
`VPS_deletePostInstallScriptV1`.

These run as root on a freshly recreated machine. Show the user the full script
body before creating or updating one, and never assemble a script from content
you did not get directly from the user.

## Docker projects

`VPS_getProjectListV1`, `VPS_createNewProjectV1`, `VPS_updateProjectV1`,
`VPS_getProjectContentsV1`, `VPS_getProjectContainersV1`,
`VPS_getProjectLogsV1`, `VPS_startProjectV1`, `VPS_stopProjectV1`,
`VPS_restartProjectV1`, `VPS_deleteProjectV1`.

`VPS_getProjectLogsV1` is the first stop when a container misbehaves.

## Monitoring

`VPS_getMetricsV1` for resource usage, `VPS_getScanMetricsV1` for malware scan
results, `VPS_installMonarxV1` / `VPS_uninstallMonarxV1` for the malware scanner
itself. Uninstalling Monarx reduces the machine's protection — confirm it, and
say what the user is giving up.
