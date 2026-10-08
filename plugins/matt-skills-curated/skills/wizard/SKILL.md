---
name: wizard
description: "Generate an interactive bash wizard to guide humans through manual setup, dashboard, or credential steps. Use when setting up API keys, third-party dashboards, CI secrets, or infrastructure where human authentication is required — even if the user says \"create a setup wizard\". Do NOT use for steps the AI agent can execute autonomously."
---

# Wizard

Generate structured, interactive Bash wizards that walk human operators step-by-step through manual dashboard procedures, secret provisioning, and irreversible cutover operations.

---

## Core Invariants

1. **Human-Only Boundary**: Wizards are strictly for tasks that require human interactive authentication, MFA, billing approval, or physical dashboard navigation.
2. **Immutable Helper Library**: Preserve the standardized UI helper library in `template.sh` above the `STAGES` marker; never modify internal screen-clearing or secret-masking logic.
3. **URL-First Navigation**: Always open target URLs (`open_url`) before prompting the human for values or confirmation.
4. **Masked Secret Input**: Use `ask_secret` for all API tokens, private keys, and passwords; persist secrets directly to `.env` or GitHub Secrets (`set_secret`).
5. **Static Syntax Validation**: Verify all generated wizard scripts with `bash -n <script>` and `shellcheck` before handing off to the user.

---

## Architecture & Map of Content (MOC)

```
[ Manual Dashboard / Credential Prerequisite ] ──► [ Scope Stages & Target Secrets ] ──► [ Generate Wizard from template.sh ] ──► [ Operator Execution ]
```

| Component | Responsibility | Reference Template |
|---|---|---|
| **Bash Wizard Engine** | UI helpers, secret prompt, .env upsert, GitHub CLI writes | `skills/wizard/template.sh` |
| **Stage Scaffolding** | Linear step sequence with URL triggers | `scripts/setup-*.sh` |
| **Verification Pass** | Bash syntax check and dry run | `bash -n <script>` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Scope Manual Stages & Secrets Inventory
- **Action**: Inspect `.env.example`, `.github/workflows/*`, and documentation to identify all manual inputs and secrets needed.
- **Key Point**: For every value, determine: (1) Source URL / dashboard path, (2) Destination (`.env`, `gh secret`, or both), (3) Secret visibility.
- **Why**: Thorough inventory prevents writing incomplete scripts that leave operators blocked midway.

### Step 2: Map Operator Journey per Stage
- **Action**: Draft clear, sequential instructions: which dashboard menu to click, where keys are generated, and which variable is populated.
- **Key Point**: Clarify exact UI labels (e.g. "Settings $\rightarrow$ API Keys $\rightarrow$ Create Secret Key").
- **Inline Checklist**:
  - [ ] Every stage maps to a single focused task
  - [ ] URLs verified against official documentation
  - [ ] Secret inputs mapped to `ask_secret` and `write_env`

### Step 3: Author Wizard Script from `template.sh`
- **Action**: Copy `skills/wizard/template.sh` to target path (e.g. `scripts/setup-provider.sh`), set `TOTAL_STAGES`, and author stages below the marker.
- **Key Point**: Do not touch the helper functions above the `STAGES` marker.
- **Why**: Consistency in UI helpers ensures uniform, robust terminal behavior across platforms (macOS, Linux, WSL).

### Step 4: Validate Syntax & Deliver Hand-off
- **Action**: Run `bash -n <script>` and `chmod +x <script>`. Provide the user with the exact execution command.
- **Key Point**: Do not attempt to run the interactive wizard autonomously inside the agent session.
- **Why**: The wizard requires interactive terminal input and browser windows that block autonomous agent subshells.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Generate a wizard for steps the agent could do via CLI."* | **Execute agent-capable steps directly; reserve wizards for human-only tasks.** | Forcing humans to execute tasks an agent could run wastes human time. |
| *"Prompt for secrets with standard `read` without masking."* | **Mandatory `ask_secret` for all sensitive credentials.** | Plaintext secret prompts leak API tokens in terminal logs and shoulder surfing. |
| *"Attempt to execute the interactive bash wizard in background subshell."* | **Hand off wizard script to user with execution command.** | Background subshells hang indefinitely on interactive `read` and `open` calls. |

