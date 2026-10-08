# Hypothesis Management

## Build a small ranked set

Keep three to five plausible hypotheses unless evidence strongly points to one.

Each hypothesis must be testable.

Weak:

> Unity is behaving strangely.

Strong:

> The player input callback is registered twice after returning to the gameplay
> scene, causing each press to trigger two attacks.

## Required fields

- hypothesis
- confidence
- supporting evidence
- contradicting evidence
- predicted observation
- discriminating experiment
- status

## Status values

- untested
- supported
- weakened
- contradicted
- confirmed
- blocked

## Experiment quality

Prefer experiments that:

- are cheap
- isolate one variable
- distinguish multiple hypotheses
- do not permanently alter the project
- produce a clear expected result
- can be repeated

## Updating confidence

Increase confidence only when new evidence is more likely under the hypothesis
than under alternatives.

Do not use confidence percentages unless they are genuinely useful.

## Stop conditions

Stop pursuing a hypothesis when:

- predicted observations fail repeatedly
- stronger contradictory evidence appears
- another hypothesis explains more evidence with fewer assumptions

## Root cause standard

A confirmed cause should explain:

- why the failure occurs
- why it occurs only under observed conditions
- why the targeted fix resolves it
- why nearby behavior remains valid
