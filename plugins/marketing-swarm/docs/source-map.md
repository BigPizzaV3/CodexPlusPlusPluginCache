# Source-to-Plugin map

The upstream project documents 15 agents in five tiers. The conversion intentionally groups related jobs.

| Upstream agent | Public Skill disposition |
| --- | --- |
| Orchestrator | `marketing-swarm-router` |
| Memory | `marketing-memory` |
| Quality | `decision-quality-gate` |
| Simulation | `scenario-simulation` |
| Historical Memory | `marketing-memory` |
| Risk Detection | `campaign-diagnostics` |
| Attention Arbitrage | `budget-media-allocation` |
| Creative Genome | `creative-genome-analysis` |
| Fatigue Forecaster | `creative-fatigue-mutation` |
| Mutation | `creative-fatigue-mutation` |
| Counterfactual | `causal-attribution` and `scenario-simulation` |
| Causal Graph | `causal-attribution` |
| Incrementality | `causal-attribution` |
| Account Health | `campaign-diagnostics` |
| Cross-Platform | `budget-media-allocation` |

Runtime-only implementation details, event-bus wiring, Claude-Flow-specific configuration, Redis state, GCP adapters, and platform credentials are not mirrored as public Skills.
