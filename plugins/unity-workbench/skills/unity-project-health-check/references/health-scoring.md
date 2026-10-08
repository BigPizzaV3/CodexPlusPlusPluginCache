# Health Scoring

A numeric score is optional and should never replace the findings.

## Suggested score

Start at 100 and subtract only for supported findings.

Suggested ranges:

- Critical: 20 to 35
- High: 8 to 18
- Medium: 3 to 7
- Low: 1 to 2

Adjust for:

- confidence
- scope
- frequency
- recoverability
- release stage

## Interpretation

- 90–100: Healthy with minor improvements
- 75–89: Generally healthy with notable risks
- 55–74: Significant technical risk
- 30–54: Unstable or release-risky
- 0–29: Critical health concerns

## Rules

- Do not score unchecked areas as healthy.
- Do not inflate scores through many trivial findings.
- Explain the dominant risks.
- Prefer severity and action order over a single number.
