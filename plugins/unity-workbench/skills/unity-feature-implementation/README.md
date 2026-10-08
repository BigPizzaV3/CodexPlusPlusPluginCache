# Unity Feature Implementation Skill

This package contains a base Codex skill for implementing Unity features using
progressive disclosure.

## Structure

- `SKILL.md`: main router and workflow
- `foundations/`: cross-cutting engineering guidance
- `specializations/`: feature-area guidance
- `frameworks/`: technology-specific guidance
- `references/`: planning, safety, capabilities, and validation

## Recommended pairing

Use with a separate `unity-project-onboarding` skill that generates a persistent
project context document.

## Installation

Copy this folder into your plugin's `skills/` directory:

```text
skills/
└── unity-feature-implementation/
```

## Design philosophy

- project architecture first
- small coherent changes
- progressive disclosure
- low coupling and high cohesion
- SOLID without overengineering
- evidence-based validation
- MCP-agnostic capability routing
