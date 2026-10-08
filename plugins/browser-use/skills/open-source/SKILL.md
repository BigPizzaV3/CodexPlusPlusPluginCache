---
name: open-source
description: Use when the user asks how to write, review, or debug Python code that uses the open-source browser-use library APIs.
---

# Browser Use Open-Source Reference

This is a **reference-only** skill for reasoning about source code that uses the browser-use Python library.

It **does not install** packages, download tools, start services, connect to external browser runtimes, or change the user's environment. It **does not execute** the code it drafts unless the host separately provides an approved execution capability and the user asks to use it.

## Use it for

- explaining library concepts and object relationships;
- reviewing user-provided browser-use code;
- drafting Python examples that use documented library concepts;
- identifying likely bugs in agent, browser, tool, model, or configuration code;
- suggesting test cases for browser-use integrations.

## Boundaries

Keep examples self-contained and focused on application code. Do not provide bootstrap commands, remote-runtime connection instructions, credential setup, access-control workarounds, or instructions for defeating website protections.

When the requested behavior depends on an external service or runtime that is not already available through the host, explain the dependency instead of claiming it was run.
