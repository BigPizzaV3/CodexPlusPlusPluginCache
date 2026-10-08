---
name: orchestrator-lite-cloud
description: Run a bounded, evidence-led research workflow in Cloud Work for Japanese or English requests. Route automatically for independent, read-heavy research, especially comparisons or synthesis across multiple named primary sources that require citations or an explicit evidence boundary; honour FORCE and OFF phrases; optionally use one read-only Cloud Researcher when a visible child-agent capability creates concrete value.
---

# Orchestrator Lite Cloud

Use this Skill for bounded research that benefits from an explicit evidence plan. It is a routing and quality-control workflow, not a requirement to delegate.

Respond in the language used by the user unless the user explicitly requests another language. The workflow and quality rules are identical for Japanese and English requests.

## 1. Select the mode

Classify the user's current request before researching. OFF overrides FORCE; FORCE overrides AUTO.

| Mode | Trigger | Required behaviour |
|---|---|---|
| OFF | The user says `Orchestratorなし`, `このTaskではSkillを使わない`, `Do not use the Orchestrator`, or `Do not use this Skill`. | Work directly. Do not describe the task as orchestrated, do not create a Researcher plan, and do not invoke a child agent. |
| FORCE | The user says `Orchestratorを使って`, `Use the Orchestrator`, or explicitly invokes `orchestrator-lite-cloud`. | Use this workflow. A separate Researcher is still optional. |
| AUTO | Default. | Use this workflow when independent, read-heavy research can materially improve the outcome, including bounded comparison or synthesis across multiple named primary sources. Keep simple, direct tasks in Main. |

For AUTO, positive routing signals include:

- comparing, synthesizing, or validating two or more named primary sources, papers, standards, official documents, or supplied links;
- reconciling source-by-source definitions, claims, disagreements, or Unknowns;
- requiring claim-level citations together with an explicit source boundary and stopping condition; or
- independently validating a consequential factual premise before a decision.

Citation, quotation, or document-formatting Skills may support this workflow. They do not replace the bounded research brief when the positive AUTO signals above make evidence planning material.

For AUTO, keep work in Main when the request is answerable from one supplied item, needs tightly coupled reasoning or editing, has a small/clear fact check, or would not gain materially from a separate evidence pass. Do not turn ordinary task execution into orchestration merely because research is possible.

## 2. Open a bounded research brief

When FORCE applies, or AUTO selects this workflow, state a compact brief before substantive research:

1. **Objective** — what must be established or produced.
2. **Decision** — what concrete decision, design choice, or recommendation the research will inform. State `None — explanatory research only` when applicable.
3. **Sources in scope** — supplied files/links first; then the specific source classes or named sources to examine. Prefer primary sources for external facts (official documentation, original papers, standards, filings, source data, or direct statements).
4. **Completion criteria** — the claims/questions that must be resolved, the evidence needed for each, and the intended output. Include an explicit stopping boundary.

Reuse supplied material before retrieving duplicates. Treat secondary sources as leads or context unless the needed primary source is unavailable; mark that limitation. Separate verified facts, reasoned inferences, and unresolved items.

## 3. Decide whether a Researcher is justified

Main owns the task by default. Delegate only when **all** conditions hold:

- the active Work environment visibly exposes a native Cloud child-agent capability;
- a read-only evidence pass can proceed independently from Main's analysis;
- the separate pass has a concrete benefit, such as checking a distinct primary-source set, comparing alternatives, or independently validating a consequential factual premise; and
- its scope can be bounded with a specific question, source scope, completion criteria, and return format.

If any condition fails, research in Main without presenting it as a failed delegation. Never create a fictional Researcher, simulate a child result, or delegate writing, editing, installation, publishing, credential use, or other side-effecting work.

At most one read-only Researcher may be delegated for a task. After that optional pass, Main continues and closes the task. If new evidence raises an outcome-changing question, assess it in Main; do not start a second child agent under this Skill.

## 4. Researcher contract (only when delegated)

Give the one Researcher a read-only contract:

- independent question and why it matters to the decision;
- exact sources/scope to inspect, with primary sources preferred;
- completion criteria and a stopping boundary;
- required return: claim-by-claim findings, direct source links or supplied-material locations, short evidence excerpts or precise locations, uncertainty/conflicts, and no final decision;
- explicit prohibition on edits, installs, publishing, external messages, credentials, or further delegation.

Do not specify or imply a role-specific model, reasoning level, token budget, or hidden platform setting. Only refer to such settings if the active Work environment visibly reports them.

## 5. Evidence and status discipline

Call someone a **Researcher that ran** only after native child-agent evidence is returned by the active environment: for example, a child-agent result/status plus its attributable findings. A plan, a prompt, an assumption, a manually written summary, or an unavailable capability is not evidence that a Researcher ran.

Until native evidence arrives, say only that Main is researching or that a Researcher was requested. If no native evidence is returned, omit any claim that the Researcher ran and complete the work from Main's evidence.

If the user asks not to mention that no Researcher ran, suppress that fact throughout all user-visible output, including progress commentary, the opening brief, the final synthesis, and the completion check. Do not say that a Researcher was unnecessary, not requested, not started, or not used; continue the work in Main without mentioning the non-event.

Use citations/links close to externally verifiable claims. For supplied material, identify the file, document section, page, or relevant passage where practical. Reconcile conflicting evidence explicitly rather than averaging or silently choosing a source.

## 6. Main's final synthesis

Main remains responsible for the final judgment. Produce a concise outcome that includes:

- answer or recommendation tied to the stated decision;
- evidence basis, with primary-source citations where available;
- material assumptions, conflicts, and Unknowns;
- completion check against the brief; and
- the narrow next action, if one is warranted.

A Researcher may contribute evidence but never supplies the final judgment or makes commitments for the user.

Finish the initial research response and any substantive final synthesis with an explicit, compact completion check against the stated completion criteria. For a routine task, use one sentence rather than a repeated table or checklist. For a narrow follow-up that directly transforms or narrows an already-bounded result without new research, a separate completion check may be omitted when the response itself makes completion unambiguous. Use bullets only when a criterion is unmet, partially met, or needs qualification. Do not repeat the opening brief verbatim.

Before returning a Markdown table, verify that the header contains one labeled cell per column and that the separator row has the same number of cells. If the table would be too wide or difficult to scan, use bullets or short subsections instead. Do not merge multiple column headings into one cell.

## Guardrails

- Do not claim role-specific models or reasoning settings unless the active Work environment visibly reports them.
- Do not estimate token use, claim automatic usage logging, or create a usage log. Mention actual usage only when Cloud exposes it and an approved durable storage destination is available.
- Do not automatically update routing policy based on one run, one failure, or informal impressions. Any future policy change needs repeated, comparable evidence and an explicit human decision.
- Stop after the one optional Researcher. Do not broaden the task or keep searching once the completion criteria are met, unless the user changes the scope or unresolved evidence changes the outcome.
