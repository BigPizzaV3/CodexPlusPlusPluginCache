# External process execution boundary

Launching a program crosses code, identity, data, resource, and operating-system authority boundaries. Threat-model the actual executable and descendant set, not merely the Go call site.

## Fix authority before start

- Select an allowlisted executable identity. Prefer an explicit trusted path or validate path resolution; do not suppress `exec.ErrDot` merely to make a workspace-local binary run.
- Pass untrusted values as individual arguments to a program with a documented argument grammar. `os/exec` does not invoke a shell by default. Introducing `sh -c`, `cmd.exe`, a batch file, or another interpreter creates a different parsing boundary that generic quoting cannot make portable.
- Construct the smallest environment the child needs. A nil `Cmd.Env` inherits the service environment, which can unintentionally delegate cloud credentials, proxy settings, search paths, debug controls, or tenant context.
- Set the working directory, standard streams, and inherited files deliberately. `Cmd.Dir` is not filesystem isolation, and omitted `ExtraFiles` does not turn a process into a sandbox.
- Use an OS sandbox, container, credential, namespace, or service boundary when the helper must not possess the parent's filesystem, network, identity, or kernel authority. Go process APIs alone do not establish that boundary.

## Bound data and resources

Validate input format and size before start. Bound stdin, stdout, stderr, generated files, wall time, CPU, memory, file count, and concurrency according to the platform threat model. `Output` and `CombinedOutput` accumulate bytes in memory; a context timeout does not itself cap output produced before cancellation.

Keep secrets out of arguments visible in process listings, inherited environment, captured diagnostics, and logs. Preserve only the bounded evidence needed to distinguish start failure, nonzero exit, cancellation, deadline, I/O failure, and policy rejection.

## Own the whole lifecycle

Call `Wait` exactly once after a successful `Start`; it releases `Cmd` resources and waits for configured I/O copying. Decide whether cancellation should request graceful shutdown, close a protocol channel, or kill immediately, then set a finite forced-stop bound when needed.

`CommandContext` defaults to killing `Cmd.Process`. That is the immediate process, not a portable descendant-tree contract. A shell or helper may fork children that survive or retain stdout and stderr descriptors. `WaitDelay` can bound waiting for the child and inherited pipes, but closing pipes is not evidence that all descendants or external effects ended.

If descendants are in scope, establish platform-specific ownership before start—such as a dedicated process group, job object, cgroup, container, or cooperative supervisor—and test its exact signal, escape, reaping, and shutdown behavior on supported operating systems. Do not add an unsafe process-group kill that could target the caller's group.

## Effect and retry boundary

A timeout after start can leave file, network, or remote effects ambiguous. Publish output atomically from a stable operation identity, reconcile preexisting partial output, and replay only under that contract. A fresh job ID after every timeout can duplicate effects even when the process is eventually killed.

Test path substitution, hostile arguments, secret inheritance, excessive output, start failure, nonzero exit, cancellation before and after start, ignored graceful shutdown, a child retaining pipes, descendant escape, partial output publication, and retry after an ambiguous timeout.
