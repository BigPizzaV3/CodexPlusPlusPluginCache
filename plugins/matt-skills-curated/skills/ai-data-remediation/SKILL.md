---
name: ai-data-remediation
description: "Self-healing data pipeline layer using semantic anomaly clustering, AST-validated lambda transformations, and zero-loss mathematical reconciliation. Use when data quality checks fail, anomalous records break ETL/ELT pipelines, you need automated data cleansing with sandboxed Python transformations, or you want to group data errors into semantic clusters — even if they don't explicitly say \"data remediation\". Do NOT use for standard database schema migrations, routine CRUD queries, or basic pipeline scheduling."
---

# AI Data Remediation

Operate a self-healing remediation layer for mission-critical data pipelines: intercept corrupt or anomalous data, semantically cluster pattern families, generate deterministic fix logic via local or sandboxed language models, and guarantee zero data loss.

## Core Principle

> **AI generates verifiable transformation logic — never touch or mutate production data directly.**

---

## Core Invariants

1. **AI Logic Over Raw Data Mutation**: The model generates pure, deterministic transformation functions that can be tested, reviewed, and versioned. Raw model outputs are never piped directly into tables.
2. **Mandatory AST Static Validation**: Every generated lambda or transformation must pass Abstract Syntax Tree (AST) validation against restricted namespaces before evaluation.
3. **Strict Zero-Loss Accounting**: Total input records must exactly equal successful records plus quarantined records ($\text{Source} = \text{Success} + \text{Quarantine}$). Any non-zero delta immediately halts processing.
4. **Air-Gapped / Privacy-Preserved Execution**: Sensitive or PII data must never egress to external cloud APIs without prior tokenization or local execution.
5. **Human Review Quarantine**: Clusters with low transformation confidence ($< 0.75$) or failed AST checks route to an isolated quarantine table with full lineage.

---

## Architecture & Map of Content (MOC)

```
[ Anomalous Records ] ──► [ Semantic Clustering ] ──► [ Sandboxed Logic Gen ] ──► [ AST Safety Gate ] ──► [ Vectorized Apply ] ──► [ Zero-Loss Audit ]
```

| Component | Responsibility | Key Mechanism |
|---|---|---|
| **Anomaly Buffer** | Staging buffer for records flagged `NEEDS_AI` | Asynchronous staging table / queue |
| **Semantic Compression** | Grouping high-volume anomalies into pattern families | Vector embeddings + similarity clustering |
| **Logic Synthesis** | Compiling deterministic lambda functions | Prompt-constrained JSON output format |
| **AST Security Gate** | Static code analysis & sandboxed execution | Python `ast.parse` + restricted builtins |
| **Reconciliation Audit** | Mathematical verification of record counts | Strict invariant: $\Delta = \text{Source} - (\text{Success} + \text{Quarantine}) = 0$ |

---

## Step-by-Step Procedure (TWI)

### Step 1: Intercept & Isolate Anomalous Records
- **Action**: Ingest failed rows from the deterministic validation layer into an isolated staging buffer.
- **Key Point**: Operate strictly downstream of primary schema validation without blocking the main ingest stream.
- **Why**: Decoupling remediation keeps upstream ingestion healthy and prevents system-wide backpressure.

### Step 2: Semantic Anomaly Compression
- **Action**: Compute vector representations of error strings and cluster them into distinct pattern families.
- **Key Point**: Compress thousands of broken rows into 5–15 representative clusters using similarity metrics.
- **Why**: Synthesizing 10 cluster-level transformation functions instead of 50,000 row-by-row LLM calls reduces execution time and compute cost by over 95%.

### Step 3: Sandboxed Logic Generation
- **Action**: Feed representative cluster exemplars to a constrained language model prompt that emits a pure Python lambda function.
- **Key Point**: Restrict output to a single lambda definition with explicit input/output type contracts.
- **Why**: Lambda functions are reproducible, testable against test suites, and easily inspected before deployment.

### Step 4: AST Safety Verification & Vectorized Application
- **Action**: Statically parse the generated lambda AST and execute across the cluster within a restricted environment.
- **Key Point**: Reject any code containing `import`, `exec`, `eval`, `__builtins__`, file I/O, or OS calls.
- **Inline Checklist**:
  - [ ] AST parsing verifies zero unauthorized node types (no `Import`, `ImportFrom`, `Call` to unapproved functions)
  - [ ] Transformation confidence score $\ge 0.75$
  - [ ] Lambda passes unit test assertions on 3 cluster sample inputs
  - [ ] Unverified or failing records route immediately to quarantine
- **Why**: Unchecked dynamic code execution presents critical security vulnerabilities and risks catastrophic database corruption.

### Step 5: Zero-Loss Reconciliation & Lineage Audit
- **Action**: Run mathematical balance checks across input, output, and quarantine tables.
- **Key Point**: Verify $\text{Source Records} = \text{Success Records} + \text{Quarantine Records}$.
- **Why**: Silent row loss corrupts financial ledgers, analytical dashboards, and downstream dependencies.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"The generated lambda looks safe, skip the AST check."* | **Mandatory AST verification on 100% of generated code.** | A single unvalidated attribute access or system call compromises execution integrity. |
| *"Only 3 rows disappeared, let's ship the batch anyway."* | **Immediate halt if $\Delta \neq 0$.** | Silent record drops compound into major audit and financial discrepancies. |
| *"Let's directly patch data strings instead of generating a function."* | **Generate logic, never mutate raw data in-place.** | Logic can be audited, unit tested, reviewed, and rolled back; raw data patches cannot. |
| *"Send full customer records with PII to public APIs for faster fix."* | **Enforce data privacy boundaries.** | PII egress violates privacy regulations and compliance mandates. |

---

## Verification & Troubleshooting

- **AST Rejection**: If the model attempts forbidden imports, tighten the system prompt to enforce pure mathematical/string transformations.
- **Low Model Confidence**: Route the entire pattern family to `quarantine_review` table for human sign-off.
- **Reconciliation Discrepancy**: Check row exception handlers to ensure failing rows are captured in quarantine rather than swallowed.
