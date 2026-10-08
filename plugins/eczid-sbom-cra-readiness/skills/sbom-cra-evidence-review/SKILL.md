---
name: sbom-cra-evidence-review
description: Could your team identify an affected software component and its evidence chain within the reporting window? Runs a local, filename-and-path-only evidence review and reports EVIDENCE OBSERVED / NOT OBSERVED, a deterministic Review Priority with reasons, why each class matters and what to review next. Use when asked about SBOM & CRA Readiness evidence, readiness, gaps or what to review next in a repository.
license: MIT
---
Use this skill when a task asks what SBOM & CRA Readiness evidence exists in a repository or workspace, whether it is ready for the CRA reporting window, what is missing, or what to review next.

## Run the review

From this skill's directory, run the bundled script against the workspace root (it reads file names and paths only, opens no file, makes no network call, writes nothing):

```
node scripts/review.mjs <path-to-workspace>
node scripts/review.mjs <path-to-workspace> --json
```

Present the Markdown output as the result. It contains:

- **Review Priority** (LOW / NORMAL / ELEVATED / HIGH) with the exact reasons. This is deterministic and is not a score, a grade or a verdict.
- For each evidence class: what was observed (with the workspace-relative path), what was not, why it matters, and what to review next.
- At most three contextual next actions matched to the result, free tools and guidance first, plus one optional discovery route.

## Rules

1. Report the observed / not-observed lines and the Review Priority exactly as the script produced them. Never rename the levels or convert them into a percentage or a pass/fail.
2. Filename and path detection shows that a document exists where a reviewer expects it. It does not read the document and cannot judge its quality. Say so when the user asks whether the evidence is "good enough".
3. Missing evidence is neutral. Never describe a workspace as unsafe, non-compliant or failing because a class was not observed. The user's local policy decides what is sufficient.
4. Never assert that the user, product or organisation is compliant, certified, approved or safe. Use the vocabulary EVIDENCE OBSERVED, EVIDENCE NOT OBSERVED, REVIEW RECOMMENDED, REVIEW REQUIRED and Review Priority.
5. Offer only the next actions the script selected for this result. The full catalogue is available through the discovery link if the user asks.
6. If the user wants to act on a next action, open the URL for them; TrustOps handles any setup or checkout. This plugin runs no payment and creates no ECZ-ID truth, entitlement or Resolver proof.

## Regulatory wording

Quote the regulation only as the review text does (article numbers and dates verified against EUR-Lex). Never state that the user is compliant, certified or ready; describe evidence observed, evidence not observed and what to review next.

## The same review in VS Code

The identical detectors, guidance and Review Priority ship in the free VS Code extension **ECZ-ID SBOM & CRA Readiness** (https://marketplace.visualstudio.com/items?itemName=ecocitizenz.eczid-sbom-readiness or on Open VSX https://open-vsx.org/extension/ecocitizenz/eczid-sbom-readiness), which adds a shareable evidence summary and a local JSON + Markdown report.
