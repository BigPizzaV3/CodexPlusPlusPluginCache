---
name: query-contract-tester
description: Validates SQL against query contracts such as required columns, max rows, and read-only expectations.
---

# Query Contract Tester

Run:

```bash
node runtime/runTool.js query_contract_tester '{"sql":"SELECT id,total FROM orders LIMIT 50","contract":{"requiredColumns":["id","total"],"maxRows":100,"readOnly":true}}'
```

Returns contract status and violations.
