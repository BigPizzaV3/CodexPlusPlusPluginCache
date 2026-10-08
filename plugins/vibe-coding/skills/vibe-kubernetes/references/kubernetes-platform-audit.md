# Kubernetes Platform Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a Kubernetes workload as a deployable runtime contract: rollout, probes, scheduling, networking, storage, policy, and operator recovery.

## Domain invariants

- Rendered workload identity, selectors, labels, ports, service accounts, configuration references, and ownership are internally consistent for the target environment.
- Startup, readiness, and liveness probes test distinct properties and do not create restart loops, premature traffic, or indefinite unready capacity.
- Rolling update parameters, progress deadline, replica count, PodDisruptionBudget, preStop/SIGTERM handling, and termination grace preserve required availability and drain semantics.
- Resource requests describe schedulable baseline demand; limits and autoscaling signals do not create CPU throttling, memory eviction, or feedback loops that violate the service SLO.
- Service/Ingress/Gateway, DNS, NetworkPolicy, proxy headers, TLS, and health paths form one reachable and least-privilege network contract.
- Stateful identity, access mode, storage class, volume binding, reclaim behavior, backup/restore, and rescheduling semantics match the application's consistency model.
- RBAC, service accounts, security context, capabilities, seccomp, filesystem mode, image identity, and secret/config exposure follow least privilege.
- Environment overlays and generated manifests are reviewed after render; a base template alone is not deployment evidence.

## Audit method

1. Render the exact target overlay/chart and map workload → ReplicaSet/Pod → Service/Ingress → config/secret → storage/policy dependencies.
2. Trace pod admission, startup, readiness, traffic, SIGTERM/drain, restart, rollout, rollback, and node disruption paths.
3. Check scheduler fit, requests/limits, priority/affinity/topology spread, HPA inputs, stabilization, and minimum healthy capacity.
4. Verify service selectors/ports, DNS names, TLS ownership, NetworkPolicy directions, and trusted proxy boundaries.
5. For stateful work, inspect attach/mount/recovery/backup and data-consistency behavior after reschedule or partial failure.

## Priority model

- **P0:** cluster or service outage, privilege exposure, data loss, invalid rollout, or unrecoverable stateful workload failure.
- **P1:** a material scheduling, probe, policy, resource, rollout, or capacity defect.
- **P2:** a lower-risk but concrete operability, efficiency, or resilience issue.
