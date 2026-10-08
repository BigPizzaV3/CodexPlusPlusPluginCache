# Example: 401 After API-Key Rotation

## Input

A customer reports all requests to GET /v2/orders return 401 after rotating their API key. They say the old key worked before rotation. Exact error: `invalid_api_key`. Production. Approximate time 09:20 UTC.

## Good investigation

Observed:
- 401 began after credential rotation.
- Error is `invalid_api_key`.
- Endpoint is GET /v2/orders.
- Production is affected.

Leading hypotheses:
1. New key is not active/recognized in production.
2. Customer is sending a malformed or wrong-environment key.
3. Credential propagation delay.
4. Header construction changed during rotation.

Do not ask the customer to paste the key.

Next checks:
- verify new credential metadata/status by non-secret identifier;
- compare credential environment;
- inspect auth-service logs for request ID if available;
- confirm header format without collecting secret value;
- check rotation/propagation events.

Assessment remains Probable/Unknown until server-side evidence confirms the failure mode.
