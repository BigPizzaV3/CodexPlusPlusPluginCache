# Delivery capability pack

Apply this pack to builds, packaging, deployments, runtime configuration, distribution and releases.

- Map changed callers to hosted dependencies and rollout order before producing or distributing an artifact.
- Keep source checks, successful build, artifact identity, upload, deployment, store processing, distribution, production availability and physical acceptance as separate gates.
- Validate public build inputs before bundling; runtime rejection cannot remove a secret or wrong value already embedded in an artifact.
- Match update compatibility to the actual binary and target environment. One platform or environment does not prove another.
- Preserve explicit authorization for deployment, publication, monitoring and rollback. A request to prepare or validate does not authorize release.
