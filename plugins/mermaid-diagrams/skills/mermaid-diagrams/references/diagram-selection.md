# Diagram selection

Choose the smallest diagram family that matches the user's question.

| Need | Mermaid family | Typical prompt |
| --- | --- | --- |
| Process or dependency | `flowchart` | Show how the app's layers connect |
| Infrastructure topology | `architecture-beta` | Show services, groups, and directional links |
| Ordered calls or messages | `sequenceDiagram` | Show login from tap to token refresh |
| Lifecycle or mode changes | `stateDiagram-v2` | Show task states and transitions |
| Types, protocols, inheritance | `classDiagram` | Show the domain model |
| Persisted entities | `erDiagram` | Show database relationships |
| Work over time | `gantt` or `timeline` | Show milestones or historical events |
| Work by status column | `kanban` | Show backlog, active, and completed items |
| Hierarchy or brainstorming | `mindmap` | Organize features by area |
| User experience stages | `journey` | Show a user completing a task |
| Requirements and verification | `requirementDiagram` | Connect requirements to tests |
| Branch and release history | `gitGraph` | Show a release branching strategy |

## Compatibility posture

Mermaid is embedded by many Markdown hosts and editors, and those hosts may ship different parser versions. Prefer established syntax for portable source. Family recognition by the static checker is not full syntax, semantic, or rendering validation. Treat architecture, block, Cynefin, event modeling, Ishikawa, packet, radar, railroad grammars, Sankey, swimlane, tree view, treemap, Venn, Wardley, XY, and ZenUML families as version-sensitive until the exact source is accepted by the intended host or an explicitly invoked local Mermaid CLI.

For a broadly compatible architecture diagram:

- Use `flowchart LR` at the top level.
- Use subgraphs for device, process, trust, network, or ownership boundaries.
- Label protocols on edges only when they matter.
- Show stores as nodes; do not imply a live call when the relationship is ownership.
- Keep the main reading path left to right and feedback/error paths visually secondary.

Use the structured `architecture` builder only when the target profile supports `architecture-beta`; otherwise prefer a flowchart with subgraphs.
