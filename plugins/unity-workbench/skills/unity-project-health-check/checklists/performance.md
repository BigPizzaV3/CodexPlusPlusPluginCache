# Performance Checklist

Inspect representative hot paths for:

- allocations per frame
- repeated `GetComponent`
- hierarchy and scene searches
- LINQ in hot paths
- frequent `Instantiate` and `Destroy`
- polling
- repeated UI rebuilds
- repeated material creation
- per-frame RPCs
- blocking operations
- expensive physics queries
- unbounded loops or collections
- unnecessary update methods
- logging in hot paths

Static findings are risks until profiler evidence confirms impact.
