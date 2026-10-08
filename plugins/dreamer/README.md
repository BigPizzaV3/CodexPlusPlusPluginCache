# Dreamer

Pick up where you left off, and turn repeated feedback into preferences you can review.

Dreamer includes two skills:

- **Dreamer** checks a work receipt against a file's SHA-256 and creates a bounded resume card. It distinguishes matching content, changed content, conflicting ownership, and missing evidence.
- **Dreamer Learn** reviews material you select and proposes up to five durable working preferences, each with source references and counterevidence. It never saves preferences automatically.

No account, hosted server, telemetry, paid API, or separate model is required by the package. The host assistant still processes material under its own data policies; local helper execution does not make a cloud assistant local or offline.

## Try it

Ask: “Check this receipt against this file and tell me what remains unproven.”

Ask: “Review these two feedback files for repeated working preferences. Compare them with my Taste file and show proposed changes without applying them.”

The receipt helper requires Python 3.10 or later, with only the standard library:

```sh
python3 scripts/dreamer.py --receipt receipt.json --artifact work-product.txt
python3 scripts/dreamer.py --receipt receipt.json --current-sha256 DIGEST --previous old-receipt.json
python3 -m unittest discover -s tests -v
```

Run these from the plugin root. Skills resolve the helper relative to their own location. Without Python, the recovery skill can describe supplied evidence but cannot claim a computed hash check.

## Limits

A matching digest proves content equality, not that a test passed or a release shipped. Redaction covers common credential patterns and is not a guarantee for arbitrary secrets. Review cards before sharing. Preference proposals depend on the host model's interpretation and require user review.

This is a skills package with a local helper. It does not expose `dream` or `dream_status` MCP tools, scan history in the background, or synchronize Taste automatically. Existing automations that require those tools need a separate workflow update; this release does not silently alter them.
