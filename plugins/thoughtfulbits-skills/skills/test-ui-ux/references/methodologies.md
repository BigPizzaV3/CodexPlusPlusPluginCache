# Methodologies

Use exactly one section per evaluator. Apply the common evidence and scoring rules before the method-specific conversion.

## Common evidence and score anchors

Return an integer from 1 through 10:

| Score | Meaning |
| --- | --- |
| 1 | The experience is unusable or the intended task is effectively impossible. |
| 3 | Major barriers make failure likely for the target user. |
| 5 | The task is workable but has substantial friction, ambiguity, or risk. |
| 7 | A strong experience with bounded, non-blocking issues. |
| 9 | Excellent, unusually clear and polished, with only minor issues. |
| 10 | Exceptional evidence across the method with no material issue. |

Scores 2, 4, 6, and 8 interpolate between adjacent anchors. Unsupported impressions cannot score above 5. A 9 or 10 requires direct, strong evidence for the supplied source type.

Use `high` confidence only when the relevant live behavior was directly exercised with strong coverage. A specification or screenshot is at most `medium` confidence. Use `low` when access, artifact coverage, or method-applicable evidence is materially incomplete.

The output contract uses common finding severities `critical`, `high`, `medium`, and `low`. Keep method-native numeric or named severities inside `methodology_data` and map them to the common labels for every object in `findings`.

Method-native arithmetic is binding. Return the inputs, calculation, and resulting integer in `methodology_data`; do not raise or lower the calculated score afterward to match an overall impression.

Independently inspect every important action on every supplied, specified, or in-scope encountered screen. Judge the whole loop from user intent and input through system response and result. Treat avoidable navigation, pointer actions, choices, fields, and repeated entry as method-relevant friction. Optimize for the simplest safe and accessible path, not the smallest raw click count.

Use `critical` only for evidence that confirms at least one of these in the requested experience:

- the core task cannot be completed;
- the flow crashes, corrupts work, or creates irreversible loss without an effective guard;
- the primary path is inaccessible to keyboard or assistive-technology users;
- consent, privacy, payment, or another consequential choice is materially deceptive.

Do not label ordinary friction, visual polish, hypothetical risk, or an untested behavior critical.

## SPARK (`spark`)

Source: Alexander Gounares, “Boring apps? Add some SPARK!” — https://www.thoughtfulbits.me/p/boring-apps-add-some-spark

Evaluate the experience across five 1–5 dimensions:

- **Simple:** the concept and primary task are obvious; setup and choices do not create avoidable complexity.
- **Purposeful and Prioritized:** the experience advances the user's important job and keeps secondary features subordinate.
- **Attractive and Attentive:** hierarchy, copy, states, and moments of craft reduce cognitive load and make the experience feel considered.
- **Reliable:** the observed or specified flow is fast, predictable, recoverable, and prevention-first. Do not infer reliability from a static artifact.
- **Known:** the experience is anchored in a problem the target user already recognizes and would prioritize, rather than requiring education that the problem exists. Clear labels support usability but do not by themselves prove Known; require customer language, research, demand, existing behavior, or an explicit evidence-backed brief. Without problem-recognition evidence, cap Known at 3.

Cite at least one item of evidence per letter. Sum the five letter scores, then convert the 5–25 total to the common scale:

Simple and Purposeful must explicitly reflect the important-action inventory: unnecessary steps, clicks, decisions, or fields lower the relevant letter score even when each individual control is understandable. A 5 for Simple requires no material avoidable step across the important actions in scope.

```text
method_score = round(1 + 9 * (spark_total - 5) / 20)
```

Return the letter scores and total in `methodology_data`.

## Nielsen heuristic evaluation (`nielsen`)

Source: Nielsen Norman Group heuristic evaluation workbook — https://media.nngroup.com/media/articles/attachments/Heuristic_Evaluation_Workbook_-_Nielsen_Norman_Group.pdf

Inspect all ten heuristics:

1. visibility of system status;
2. match between the system and the real world;
3. user control and freedom;
4. consistency and standards;
5. error prevention;
6. recognition rather than recall;
7. flexibility and efficiency of use;
8. aesthetic and minimalist design;
9. recognition, diagnosis, and recovery from errors; and
10. help and documentation.

Use the action loops when evaluating flexibility and efficiency of use, aesthetic and minimalist design, recognition rather than recall, user control, and error prevention. Record avoidable repeated entry or navigation as a violation with severity proportional to its frequency and effect; do not count a necessary safety step as a violation.

Assign each confirmed violation severity 1–4:

- 1 cosmetic;
- 2 minor friction;
- 3 major usability problem; or
- 4 task-blocking catastrophe.

Start at 10 and deduct 0.25, 0.75, 1.5, or 3 points respectively. Round the result to the nearest integer and clamp it to 1–10. A severity-4 violation on the core task is critical. Return every checked heuristic and violation in `methodology_data`; do not manufacture violations to lower a strong experience.

Map Nielsen severities to output finding severities: 1 to `low`, 2 to `medium`, 3 to `high`, and 4 to `critical` when it meets the common critical definition (otherwise `high`).

## Cognitive walkthrough (`cognitive_walkthrough`)

Sources: Polson, Lewis, Rieman, and Wharton; Wharton et al., cognitive walkthrough research — https://doi.org/10.1145/142750.142864

Decompose every important action loop in scope into observable actions. For every action answer:

1. Will the target user try to achieve the right effect?
2. Will the target user notice that the correct action is available?
3. Will the target user associate that action with the intended effect?
4. After acting, will the user understand the feedback and progress?

Score every answer `pass` = 1, `partial` = 0.5, or `fail` = 0. Calculate:

```text
method_score = round(1 + 9 * earned_points / possible_points)
```

Clamp to 1–10. If a failed check makes the core task impossible, cap the method score at 3 and record a critical failure. Return the action table and calculation in `methodology_data`.

For screenshots or specs, phrase outcomes as predicted discoverability or designed provisions, not observed user behavior.

## PURE (`pure`)

Source: Christian Rohrer and Jeff Sauro, Practical Usability Rating by Experts — https://measuringu.com/pure/

Decompose every requested task into the logical steps the target user must take. Independently rate each step:

- **1:** easy, low cognitive load, familiar pattern;
- **2:** meaningful cognitive effort but generally achievable; or
- **3:** difficult or confusing, with likely failure for some target users.

Preserve the native PURE total, mean, worst step, and step count. Convert the mean step difficulty to the common score:

| Mean difficulty | Base score |
| --- | --- |
| exactly 1.00, no avoidable step | 10 |
| 1.00–1.19 | 9 |
| 1.20–1.39 | 8 |
| 1.40–1.59 | 7 |
| 1.60–1.79 | 6 |
| 1.80–1.99 | 5 |
| 2.00–2.19 | 4 |
| 2.20–2.39 | 3 |
| 2.40–2.69 | 2 |
| 2.70–3.00 | 1 |

Cap the method score at 5 when any step rates 3. If that step makes the core task impossible, cap at 3 and record a critical failure. Return the step table and native measures in `methodology_data`.

PURE owns the shared quantitative action inventory. Put it in `methodology_data.action_analysis` using the exact schema in `output-contract.md`.

Counting rules:

- A logical step is one deliberate user interaction or one passive system wait represented in the ordered loop. `current_counts.logical_steps` counts user interactions only; `system_wait` entries remain visible but do not add to that total.
- Completing one text field is one `field_entry` step, not one step per keystroke. Record its pointer activations separately so keyboard and pointer paths remain distinguishable.
- `clicks_taps` is the sum of every step's `pointer_activations`.
- `required_fields` and `optional_fields` count the corresponding objects in `inputs`.
- Use `null` for a count that static or blocked evidence cannot establish. Do not estimate hidden screens or transitions.

For each input, recommend exactly one of: keep user-required, make optional, prefill known data, derive automatically, provide an editable AI draft with confirmation, or remove. AI drafts always require confirmation. Mark identity, authentication, consent, payment, legal-attestation, and destructive-decision inputs as sensitive or consequential; never recommend AI generation for them.

The simplest-safe path may contain more interactions than the current path when a confirmation, consent, or recovery safeguard is missing. Do not call a safety step avoidable merely to improve the count.

Use the same task decomposition between loop runs. A changed task or path creates a new baseline.

## WCAG 2.2 AA (`wcag_2_2_aa`)

Sources: W3C WCAG 2 overview and WCAG 2.2 Recommendation — https://www.w3.org/WAI/standards-guidelines/wcag/ and https://www.w3.org/TR/WCAG22/

Evaluate applicable Level A and AA behavior across:

- perceivable content, alternatives, contrast, reflow, and state communication;
- keyboard access, visible focus, navigation, target size, motion, and timing;
- readable labels, predictable interaction, instructions, validation, and recovery; and
- semantic structure, names, roles, values, and assistive-technology compatibility.

Test keyboard behavior and inspect semantics for live targets. Automation may contribute evidence but cannot establish conformance by itself. Static screenshots support only visible-risk findings. Specs support only designed provisions.

Classify confirmed issues:

- **minor:** localized friction with an accessible alternative, deduct 0.5;
- **serious:** materially impedes access, deduct 1.5; or
- **critical:** blocks the primary path, deduct 3 and record a critical failure.

Start at 10, round to the nearest integer, and clamp to 1–10. Return applicable checks, issue classifications, untested checks, and calculation in `methodology_data`.

Map accessibility issue classifications to output finding severities: minor to `low`, serious to `high`, and critical to `critical`.

Never state that the product conforms to WCAG unless a complete conformance evaluation supports that claim. This method score is an audit signal, not a conformance certificate.

Apply checks to every important action loop, including equivalent keyboard and assistive-technology paths. A pointer-count reduction is not an improvement when it removes a label, focus target, confirmation, error recovery, or other accessible safeguard.
