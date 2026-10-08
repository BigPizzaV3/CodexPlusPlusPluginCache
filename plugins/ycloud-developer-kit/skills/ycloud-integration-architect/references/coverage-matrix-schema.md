# Coverage matrix schema

Use one row per selected atomic capability. `full-first-wave` requires exactly
19 rows; `full-whatsapp-operations` requires exactly 62 rows; and
`full-supported-operations` requires exactly 90 rows. None permits silent
omissions.

## Required fields

| Field | Meaning |
| --- | --- |
| `capability_id` | Stable operation ID or explicit `crosscutting:` ID |
| `domain_owner` | Single owner Skill |
| `user_outcome` | Observable behavior, not a page or menu label |
| `contract_source` | Exact generated reference and provenance |
| `wave` | `first-wave`, `second-wave`, `third-wave`, `excluded-by-product-decision`, or `crosscutting` |
| `selected_scope` | Included/excluded with reason |
| `project_seam` | Client, service, handler, config, view, or test artifact |
| `handoff_in` / `handoff_out` | Producer/consumer capability IDs and data |
| `implementation_status` | `not-started`, `implemented`, `deferred`, `blocked`, `future`, or `excluded-by-product-decision` |
| `test_status` | Unit, contract, integration, manual, or not run, with evidence |
| `test_console_exposure` | `exposed`, `read-only`, `synthetic-only`, or `not-applicable` |
| `production_readiness` | `ready`, `gap`, or `not-assessed` |
| `risk_and_authorization` | Required authorization and sensitive-data boundary |
| `evidence` | Concrete files, symbols, tests, and results |
| `defer_reason` | Required for `deferred` or `blocked` |

## Completion rules

- A route, card, form, example payload, or displayed operation name alone is not
  implementation evidence.
- `implemented` requires a linked executable project seam and at least one
  behavior test. A cross-domain row also requires producer and consumer handoff
  evidence.
- `test_status` distinguishes authored tests from tests actually run. Do not
  report `passed` without a command/result or equivalent receipt.
- UI, backend, tests, and scenarios are separate evidence dimensions. A UI may
  be `not-applicable` under a backend-only focused scope; it may not self-exempt
  a `test-console` scope.
- Unknown or unsupported framework adapters fail closed. Do not infer coverage
  from source-text keywords.
- Future and product-excluded rows never count toward covered implementation completion.

## Result states

Use `declared` when a project claims a row and `linked` when evidence resolves to
a real executable seam. Use `execution-claimed` only when a caller-supplied,
source-bound no-network test receipt claims a pass. The receipt producer and
non-cryptographic trust boundary remain visible in the report; this state verifies
the receipt binding, not the claimed execution. Report `missing`, `invalid`, or
`failed` separately. `linked` is structurally verified; `execution-claimed` is not
an authenticated execution result.
