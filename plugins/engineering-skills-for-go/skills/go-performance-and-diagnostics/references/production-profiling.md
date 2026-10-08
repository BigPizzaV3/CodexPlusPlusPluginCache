# Production profiling controls

A production profile is an experiment against a live process and an artifact about that process. Define the diagnostic question, permitted cohort, collection cost, access path, comparison metadata, and retention before enabling it.

## Constrain the access surface

`net/http/pprof` exposes handlers below `/debug/pprof/`, including CPU profile, heap and goroutine profiles, command-line data, symbol lookup, and execution trace. A blank import registers them on `http.DefaultServeMux`; whether that mux is reachable depends on the application's server wiring. Do not assume the example localhost listener is a production security design.

Prefer an explicit dedicated mux on a private administrative listener. Authenticate and authorize collection at a non-bypassable boundary, restrict network reachability, bound response sizes and durations, and audit who collected which profile from which process. Never attach the default mux to a public application listener merely to enable diagnostics.

Classify profiles and traces before storage or sharing. They can reveal binary and package structure, file paths, command-line arguments, stack shape, labels, workload timing, and retained-object evidence. Keep secrets and sensitive tenant identifiers out of profiler labels and command arguments; protect artifacts with access, encryption, retention, and deletion controls appropriate to the system.

## Bound experimental interference

Choose the cheapest signal that can falsify the hypothesis. Estimate overhead under a representative workload before production use. CPU profiling, execution tracing, forced garbage collection, block profiling, mutex profiling, and high-cardinality labels can change the schedule or cost being measured.

Collect one profile type at a time unless the documented diagnostic specifically requires overlap and the interference is accounted for. `runtime/pprof.StartCPUProfile` fails when CPU profiling is already active; coordinate manual, HTTP, and continuous profilers through one owner. Stagger collection across a small representative cohort instead of starting expensive captures on every replica during the incident.

`runtime.SetBlockProfileRate` and `runtime.SetMutexProfileFraction` change process-wide sampling. Record the prior setting, apply a bounded approved rate, and restore it. A heap request that forces GC changes the observed workload and heap snapshot; label it as an intervention rather than silently comparing it with an unforced profile.

## Preserve comparison identity

Bind every artifact to immutable binary or build identity, source commit, Go version, architecture, `GOMAXPROCS`, runtime configuration, profile type and sampling settings, process and deployment generation, traffic cohort, collection interval, achieved throughput, errors, and relevant resource limits. A profile from a different binary, sampling rate, traffic phase, or unit is not a clean before/after comparison.

Sampled stacks describe the selected interval and sample configuration. They do not prove that an unobserved path is cheap or that a fleet-wide regression affects every cohort. Correlate profile findings with production metrics and traces, change one causal mechanism, then repeat under comparable conditions.
