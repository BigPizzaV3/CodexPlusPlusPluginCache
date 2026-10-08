# Code Quality Checklist

Inspect representative first-party code for:

- null and lifetime handling
- exception swallowing
- broad catch blocks
- async cancellation
- event unsubscription
- mutable public fields
- magic strings used as APIs
- repeated expensive operations
- dead or unreachable code
- debug code left in production
- conditional compilation risks
- reflection and string-based references
- inconsistent error handling
- duplicated authoritative state
- unsafe thread access to Unity APIs

Do not report purely stylistic preferences unless the project defines them.
