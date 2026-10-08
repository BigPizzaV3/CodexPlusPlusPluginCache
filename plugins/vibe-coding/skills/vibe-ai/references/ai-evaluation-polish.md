# AI Evaluation Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed AI Evaluation improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix task and data validity before adding more metrics or model-judge complexity.
- Version dataset, preprocessing, prompts, model/settings, scorers, rubrics, thresholds, and reports as one evaluation lineage.
- Use deterministic checks for verifiable properties and calibrated human/judge scoring only for genuinely semantic properties.
- Add risk slices and regression cases from real failure modes while keeping a protected release set separate from iterative development.
- Make the release gate interpretable: name blocking failures, uncertainty, allowed variance, and override owner.

## Validation

- Re-run the same versioned evaluation and verify reproducibility or report measured stochastic variance.
- Validate scorer/judge behavior against labelled cases and report disagreement by slice/failure class.
- Run paired baseline/candidate comparison with uncertainty, latency, cost, and safety evidence; list private/online gates separately.
