---
name: x402
description: Use when the user explicitly asks for conceptual guidance, code review, or debugging help for x402 payment integration with Browser Use, without handling secrets or initiating transactions.
---

# Browser Use x402 Reference

Reference-only guidance for understanding and reviewing x402 integrations around Browser Use.

## Scope

Use this skill to:
- explain the x402 request/response model at a high level;
- review user-provided integration code for structure, error handling, and configuration mistakes;
- explain how HTTP 402 payment-required flows fit into Browser Use architectures;
- help interpret non-sensitive logs or errors supplied by the user;
- identify which part of an integration belongs to the application, payment client, Browser Use service, or host environment.

## Safety and execution boundaries

This skill is reference-only. It does not install packages, download or execute external code, create accounts or wallets, or initiate financial transactions.

Never request or handle wallet secrets, recovery material, authentication secrets, or other sensitive credentials. Do not ask the user to paste them into chat or write them to files.

This skill does not initiate payments, move funds, purchase assets, top up balances, or perform on-chain actions. If a workflow requires a payment-capable client, assume the user has already configured it outside this skill and limit assistance to conceptual review and non-sensitive debugging.

Respect authentication, access controls, service policies, browser security boundaries, and other usage restrictions.

## Host capability adaptation

1. Prefer approved host-managed capabilities already available in ChatGPT or Codex.
2. If the user supplies code or logs, analyze only the supplied material and explain the likely integration issue.
3. If an external runtime would be required to complete an action, state that limitation instead of attempting to bootstrap, install, or invoke it.
4. Never fabricate a successful request, payment result, balance, transaction, or service response.

## Review checklist

When reviewing an x402 integration, check:
- whether a 402 response is handled as an expected protocol state rather than a generic failure;
- whether payment-related configuration is separated from application logic;
- whether retry behavior is bounded and avoids duplicate charge attempts;
- whether errors are surfaced without exposing sensitive values;
- whether the application distinguishes transport errors, authorization errors, payment-required responses, and service errors;
- whether the user has a safe test environment before any real-world payment-enabled deployment.

## Output style

Give concise architecture guidance, code-review findings, or debugging hypotheses. Clearly distinguish what can be inferred from the user's code/logs from what would require an external service or payment-capable runtime to verify.
