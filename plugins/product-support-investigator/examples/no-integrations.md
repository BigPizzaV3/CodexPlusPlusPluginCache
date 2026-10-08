# Example: No Zendesk and No Datadog

## Input

"Customer says POST /payments returns 500.
Timestamp: 10:42 UTC
Request ID: abc123
Response: Internal Server Error."

No external integrations are available.

## Good investigation

Observed:
- POST /payments returned HTTP 500.
- Request ID is abc123.
- Approximate event time is 10:42 UTC.

Unknown:
- environment;
- server-side exception;
- trace;
- application version;
- deployment/configuration history;
- dependency/database behavior;
- customer scope;
- reproducibility.

Root Cause Assessment:
- Unknown
- Confidence: Low
- Insufficient evidence to determine the root cause.

Next evidence:
1. Search application logs or traces for `abc123`.
2. Confirm environment and timezone.
3. Check recent deployment/config/feature-flag changes around 10:42.
4. Inspect downstream dependency/DB calls tied to the request.
5. Compare one nearby successful payment request.

Customer response:
"We have the failing request identifier and time and are investigating the server-side failure. If available, please also confirm the affected environment and whether the issue is reproducible. We will use the request ID to trace the failure internally."

The skill remains useful without Zendesk or Datadog.
