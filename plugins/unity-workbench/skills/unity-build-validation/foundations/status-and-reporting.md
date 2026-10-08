# Validation Status and Reporting

## Ready

Use only when all required acceptance criteria passed and no blocking regression
remains.

## Ready with limitations

Use when required core criteria passed, but explicitly non-blocking validation
was unavailable or deferred.

Examples:

- Android build passed, but a low-priority tablet layout check was not run.
- Feature tests passed, but no performance budget was specified.

Do not use when a required criterion was skipped.

## Blocked

Use when validation could not proceed due to environment, credentials, missing
device, unavailable Editor, external service, or another blocker.

## Failed

Use when one or more required criteria failed.

## Not validated

Use when no meaningful validation was performed.

## Reporting requirements

Always state:

- exact scope
- exact evidence
- exact failures
- pre-existing versus introduced status
- unverified areas
- artifact paths
- next required action

Avoid vague language such as:

- looks good
- should work
- probably ready
- fully tested

unless the evidence truly supports it.
