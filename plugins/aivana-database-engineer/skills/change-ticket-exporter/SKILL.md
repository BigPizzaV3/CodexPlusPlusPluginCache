---
name: change-ticket-exporter
description: Export approval-ready production change tickets with problem, recommendation, risk, rollback, and checklist.
---

# Change Ticket Exporter

Run:

```bash
node runtime/runTool.js change_ticket_exporter '{"title":"Add checkout index","problem":"p95 breach","recommendation":"create index","rollback":"drop index"}'
```

Returns ticket fields, approval checklist, labels, and export formats.
