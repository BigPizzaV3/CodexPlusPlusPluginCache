# Full first-wave mode

Cover the original first-wave compatibility subset, not all currently supported
Developer Kit capabilities. State `17/95` prominently and
account for exactly 19 coverage rows: 17 API operations + 2 cross-cutting
capabilities (API Authentication and the common Webhook Receiver).

- Read the capability catalog summary and coverage matrix schema.
- Route rows to their unique domain owner and preserve cross-domain handoffs.
- Every selected row must be implemented, deferred, or blocked with concrete
  evidence/reason. No row may disappear because the project lacks a UI.
- A backend-only integration can mark UI not applicable; a test-console
  deliverable cannot.
- Do not equate navigation, forms, hard-coded JSON, or operation labels with
  implementation.
- Disclose the nonselected current classifications: 43 second-wave covered
  operations, 28 third-wave covered operations, and 7 excluded by product decision. Do not
  call the 71 later-wave operations unsupported or describe product exclusion
  as provider deprecation.
- Full-first-wave by itself does not request a dashboard. Use the project's
  existing architecture and expose only interfaces the user requested.
