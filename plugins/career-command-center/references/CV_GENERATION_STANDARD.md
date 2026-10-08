# Career Command Center CV Generation Standard

Version: 2.0
Status: Mandatory

This is the source of truth for every master and job-specific CV produced by Career Command Center. User facts come from the workspace evidence bank. Old CVs are audit material, never factual proof.

## 1. Required inputs

Read before drafting:

1. `Config/command_center_config.json`.
2. `Evidence_Bank/Verified_Evidence_Ledger.md`.
3. `Evidence_Bank/approved_evidence.json`.
4. `Evidence_Bank/intake_answers.md`.
5. `Evidence_Bank/personalized_questions.json`, with no material answer awaiting Codex review.
6. The complete verified job-posting snapshot.
7. A primary report, transcript, certificate, recommendation, or portfolio source for any unsettled claim.

If the ledger and evidence bank do not exist, build them before generating a CV. Resolve or explicitly exclude material personalized questions before approving a role-family master. Do not compensate for missing evidence with generic prose.

## 2. Evidence classification

Every material claim must be classified as one of:

- **Verified fact:** directly supported by a primary source or explicit user confirmation.
- **Measured result:** observed after implementation and supported by evidence.
- **Estimate:** a reasoned projection that remains visibly labelled as estimated.
- **Scale descriptor:** dataset size, model size, test count, frequency range, team size, or other context that is not itself an outcome.
- **Shared contribution:** team work where individual ownership is bounded.
- **Growth area:** requested capability that is not demonstrated and must not be disguised as experience.
- **Blocked claim:** uncertain, contradicted, proposed, or explicitly excluded by the user.

Never turn an estimate, proposal, team result, or course exposure into a measured individual achievement.

## 3. Stable role-family masters

Build two to four master CVs after the evidence audit, using the role families selected in config. Typical families include:

- R&D, product, systems, test, and validation engineering.
- Simulation, finite elements, computational engineering, and scientific modelling.
- Data science, machine learning, computer vision, and scientific software.
- Robotics, controls, automation, and embedded or hardware-software integration.
- Research and PhD applications where academic evidence needs different emphasis.

Each master must be a coherent professional identity. Do not merge every possible identity into one document.

For every master:

- Fix degree names, dates, employers, job titles, language levels, permit facts, and core accomplishment facts.
- Record the master path in `Config/command_center_config.json` under `cv.selectedMasterPaths`.
- Retain editable source, application PDF, extracted text, and rendered-page previews.
- Pass the same evidence and visual checks required of a tailored CV.

## 4. Job-specific tailoring

Start from exactly one approved master. Never start from a blank page or an old tailored CV.

Tailor through:

- A broad truthful headline within the selected role family.
- A 40-55 word profile using two or three supported evidence areas.
- Professional-bullet order.
- Selection and order of normally three strong projects.
- Skill order and accurate vacancy terminology.
- Removal of lower-value material.

Do not:

- Copy the advertised title as the candidate identity unless it is already broadly true.
- Mirror the vacancy sentence by sentence.
- Add recruiter-facing sections such as `Why I Match`, `Additional Evidence`, or `Role Fit`.
- Repeat an experience, project, or bullet in another section.
- Add unsupported seniority, regulatory, clinical, production, leadership, or domain-expert claims.
- Invent KPIs because a valid engineering outcome is qualitative or negative.
- Turn the education section into a transcript or coursework catalogue.

The CV should look naturally focused. Targeting should be detectable through relevance, not through visible manipulation.

## 5. Content architecture

Default order for industry and most research applications:

### Page 1

1. Name, broad headline, contact details, work-authorisation line, and country-appropriate photograph.
2. Profile.
3. Education.
4. Professional experience in reverse chronology.
5. Current activity when needed to make the timeline clear.

### Page 2

1. Selected projects or research.
2. Technical skills.
3. Languages and concise additional information.

Academic programmes may move research before industry experience when the posting and evidence justify it. Record that decision in tailoring notes.

## 6. Bullet standard

Each important bullet should answer at least two of:

- What problem or system was involved?
- What did the candidate personally do?
- Which method or tool was used?
- What was the scale or constraint?
- What result, finding, comparison, or engineering decision followed?

Guidelines:

- Prefer 18-32 words; review anything above 41 words.
- Use one primary action per bullet.
- Use numbers only when verified and correctly classified.
- Negative findings, ruled-out approaches, and retained designs are valid outcomes.
- Use precise technical nouns and ordinary verbs.
- Remove generic claims that could describe any candidate.

## 7. Visual and ATS standard

- A4 or local standard page size based on the target country; default to A4.
- Normally two pages unless config or application rules require otherwise.
- One-column body with natural top-to-bottom extraction order.
- Common professional sans-serif typeface with approximately 10-10.7 pt body text.
- Restrained accent colour, dark body text, thin rules, and adequate white space.
- No sidebar, skill bars, rating graphics, decorative cards, or multi-column body.
- No icons in essential contact information if they interfere with extraction.
- A photograph is included only when config permits it and target-country norms support it. Preserve aspect ratio and use a small circular crop if a photo is used.
- The PDF is the application file. Keep an editable source and extracted plain text.

## 8. Country adaptation

Country conventions may alter page size, photograph use, address detail, language, and personal-data expectations. They do not alter the evidence standard.

- Never add date of birth, nationality, marital status, or a photograph without user preference and a defensible local reason.
- Do not infer work authorisation from education, nationality, location, or prior employment.
- Translate only when the target language and review quality are sufficient.

## 9. Mandatory package record

Each application folder must include `tailoring_notes.md` containing:

- Verified canonical posting URL and snapshot path.
- `CV strategy: v2.0`.
- Exact `Base master:` path.
- At least three selected evidence IDs.
- Added, removed, and reordered content.
- Known stretches or growth areas.
- Human review outcome: `pass`, `pass with known stretch`, or `revise before applying`.
- Quality-check commands and outcomes.

## 10. Acceptance gates

A tailored CV is ready only when all applicable checks pass:

- Page count and file-size limits.
- Stable identity facts and dates.
- Evidence traceability for every material claim and metric.
- No duplicated or near-duplicated experience, project, or bullet.
- No blocked claim or unlabelled estimate.
- No visible transcript dump or vacancy imitation.
- Maximum bullet length of 41 words.
- Correct section order and readable extracted text.
- PDF and editable-source renders contain no clipping, overlap, broken wrapping, blank pages, black artifacts, or stretched photograph.
- A recruiter can understand the role-family fit in roughly 20 seconds.

Do not mark a package ready while any blocker remains.

## 11. Change control

The strategy is stable. User-specific facts, role families, and country preferences may change through verified evidence and config. The evidence classification, master-first workflow, natural targeting, and acceptance gates may change only with explicit user approval.
