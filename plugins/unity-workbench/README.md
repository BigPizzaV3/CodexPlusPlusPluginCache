# Unity Essentials

Unity Essentials is a Codex plugin for Unity project work. It helps Codex choose between Unity MCP providers, verify the connection, inspect unfamiliar projects, implement features, investigate bugs, audit project health, and validate builds while working conservatively in Unity projects.

## Included

- `unity-mcp-workflow` skill for Unity MCP setup and project-safe Unity work.
- `unity-project-onboarding` skill for read-only project discovery and context documentation.
- `unity-feature-implementation` skill for focused Unity feature work.
- `unity-bug-investigation` skill for evidence-first debugging.
- `unity-project-health-check` skill for read-only technical audits.
- `unity-build-validation` skill for compile, test, build, and release-readiness validation.
- `scripts/unity_mcp_advisor.py` for quick project/provider checks.

## Provider Notes

- Official Unity MCP is the preferred default when the project is on Unity 6 or newer and the Unity AI Assistant package/subscription requirements are met.
- CoplayDev/unity-mcp is the most visible open-source Unity MCP option found during setup.
- IvanMurzak/Unity-MCP and CoderGamester/mcp-unity are useful alternatives depending on whether the user wants runtime features, generated skills, CLI setup, or a Node.js-backed bridge.

Unity Essentials does not install every Unity MCP provider. It checks whether the project already has one, uses the existing bridge when appropriate, and guides the user toward one provider when no MCP is configured.

## Surface Notes

Unity Essentials is most useful in Codex with the Unity project folder open. In plain Chat mode, it can explain workflows and reason from pasted evidence, but it cannot inspect local folders, detect project MCP setup, read Unity Console output, or validate builds unless that evidence is provided.
