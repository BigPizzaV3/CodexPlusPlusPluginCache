---
name: research
description: "Investigate a technical question against high-trust primary sources and capture findings as a cited Markdown note. Use when gathering API facts, reading documentation, verifying library capabilities, or delegating reading legwork — even if the user says \"look into this library\". Do NOT use for writing production feature code."
---

# Research

Investigate technical questions, library capabilities, and architectural facts against authoritative primary sources, capturing verifiable findings in a cited Markdown research note.

---

## Core Invariants

1. **Primary Sources Exclusively**: Ground all findings in official documentation, source code, formal specifications, or first-party release notes; never rely on unverified blog posts or secondary summaries.
2. **Mandatory Attribution & Line-Level Citations**: Every technical claim, API signature, or version constraint must link directly to its primary source URI or repo file path.
3. **Background Agent Execution**: Run intensive reading, scraping, and repository audits in an isolated background subagent to preserve the primary agent's working context.
4. **Structured Decision Markdown Output**: Synthesize research into a permanent markdown file matching project conventions (e.g. `docs/research/<slug>.md` or `.scratch/research/<slug>.md`).
5. **Separation of Fact vs. Opinion**: Explicitly separate verified architectural facts from subjective engineering recommendations.

---

## Architecture & Map of Content (MOC)

```
[ Technical Question / Library Query ] ──► [ Spawn Research Subagent ] ──► [ Primary Source Retrieval ] ──► [ Cited Synthesis Report ]
```

| Component | Responsibility | Output Target |
|---|---|---|
| **Primary Source Auditor** | Read official docs, Github repos, specs | Web search & URL content tools |
| **Research Note** | Structured findings with quotes & citations | `docs/research/<topic>.md` |
| **Verification Gate** | Validate API signatures against runtime/version | Direct test snippets |

---

## Step-by-Step Procedure (TWI)

### Step 1: Formulate Research Hypothesis & Boundary
- **Action**: Define the core technical questions, necessary library versions, and compatibility requirements.
- **Key Point**: Distinguish between hard technical limits (e.g. rate limits, memory footprint) and ergonomic trade-offs.
- **Why**: Unbounded research spirals into excessive token consumption without answering the core decision question.

### Step 2: Query Authoritative Primary Sources
- **Action**: Fetch primary documentation, GitHub repositories, RFCs, and API references using search and web tools.
- **Key Point**: Verify the exact version compatibility against the project's `package.json`, `pyproject.toml`, or `Cargo.toml`.
- **Inline Checklist**:
  - [ ] Source is first-party / authoritative
  - [ ] Version matches project environment
  - [ ] Exact API signatures and failure modes captured

### Step 3: Author Cited Research Note
- **Action**: Write the synthesis to `docs/research/<slug>.md` (or project standard path):
  - **Summary**: High-level verdict and recommended direction.
  - **Key Findings**: Concrete technical facts with direct markdown links.
  - **Code Samples**: Minimal, validated usage examples.
  - **Trade-offs & Gotchas**: Edge cases, performance bottlenecks, and limitations.
- **Why**: Permanent research notes preserve institutional context and prevent repeating research across engineering cycles.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I remember how this library works from training data, so no need to look up current docs."* | **Mandatory primary-source lookup for all library facts.** | Training memory hallucinates deprecated API signatures and misses recent breaking changes. |
| *"Summarize from a third-party tutorial or forum post."* | **Trace claims back to the authoritative primary source.** | Third-party tutorials often propagate anti-patterns and outdated workarounds. |
| *"Inline the full research text into chat without writing a file."* | **Always commit findings to a durable research note.** | In-chat findings vanish across context resets; markdown files provide persistent documentation. |

