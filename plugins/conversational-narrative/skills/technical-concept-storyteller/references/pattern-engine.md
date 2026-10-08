# Diagnostic Narrative Pattern Engine

This is a movement model, not a rigid template.

## Core movement

1. **Friction**: something feels wrong, incomplete, or too easy.
2. **Context**: show what the practitioner was doing when the friction appeared.
3. **Naive answer**: state the easy conclusion a dashboard, tool, or meeting might produce.
4. **Break it**: use evidence or a short question cascade to show why that conclusion is incomplete.
5. **Name the concept**: introduce the technical term only after the reader already needs it.
6. **Make it concrete**: use one scenario, number, constraint, or failure state.
7. **Decision consequence**: explain what changes in the real decision.
8. **New complication**: let the answer create the next question.
9. **What changed**: show the method, check, architecture choice, experiment, or behavior that followed.
10. **What is still unproven**: state the evidence boundary honestly.
11. **Next thing to test**: close on the next unresolved problem when writing a series.

## Question cascades

Use question cascades to attack one assumption, not as decoration.

A long post normally needs no more than two or three strong cascades. If every section contains a cascade, the device becomes visible and synthetic.

## Concrete -> abstract -> concrete

For technical sections, keep cycling through:

`real observation -> concept -> practical implication`

A concept that never changes a decision probably does not deserve much space in the post.

## Architecture or product decisions

When explaining something the author built, do not list features first.

Prefer:

`what bothered me -> easy option I rejected -> why it failed -> what I built -> what changed -> remaining risk`

This makes design logic legible and keeps the post from becoming release notes.

## Contrast

Useful distinctions are welcome, for example attribution vs causality or simulation vs optimization. Do not express every distinction with the same `not X, but Y` syntax. Vary the form: question, example, counterexample, side-by-side comparison, or consequence.
