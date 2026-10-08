# Test-console mode

Build or plan a non-production testing surface for either focused or
full-first-wave, full-whatsapp-operations, or full-supported-operations scope. The deliverable is behavior,
not a prescribed frontend.

- Reuse the project's existing framework and design system. A CLI, HTTP
  collection, server-rendered page, or browser UI can satisfy the request when
  appropriate; never introduce a framework without project/user support.
- Drive controls from the selected capability catalog. Support conditional
  request fields instead of a single hard-coded JSON body.
- Default to synthetic/mock execution. Keep real sends, uploads, deletes,
  rotations, and remote endpoint mutations disabled and visibly gated.
- Show request validation, provider error envelope, `YCloud-Request-ID`,
  pagination/rate-limit metadata where applicable, and accepted versus final
  status separately.
- Preserve cross-domain handoffs such as uploaded media into message
  composition and template status into template sending.
- Provide observable Webhook receiver outcomes for signature validity,
  duplicate, conflict, unsupported/unknown event, and durable acceptance when
  those rows are selected.
- Report backend, test-console exposure, tests, and scenario evidence
  independently; a rendered control without a linked backend is incomplete.
