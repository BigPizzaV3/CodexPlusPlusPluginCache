# HeyTraders CLI bootstrap reference

The page-defined WebMCP tool and bundled adapter accept the same structured envelope:

```json
{
  "command": "<live command>",
  "args": {}
}
```

`help list` and `help describe` are the only fixed discovery bootstrap. Treat their live output as authoritative for every domain, command name, argument schema, result schema, readiness requirement, pagination rule, and workflow hint.

Discovery remains subject to the public scope in `../SKILL.md`: navigation, documentation, read-only market and account information, chart operations, backtests, and explicitly simulated paper strategies. Do not describe or call real-order, live-mode strategy, exchange-connection, wallet-connection, credential, or venue-permission commands. A mixed-mode strategy command is usable only with an explicit `paper` request and verified paper result.

Use the selector-only canonical command and pass its declared operands directly in `args`. Do not use wrapper aliases or combine args with positional values or `--json`. Human CLI compatibility is published separately as `cliUsage` and is used with empty args. Current contracts already available in the task can be reused; discover again on an unknown command, schema error, or changed contract.

Do not copy command families, route IDs, chart actions, venue IDs, or application policies into provider guidance. If the live result contains a next-discovery instruction or cursor, follow that result rather than a remembered sequence.

The adapter forwards the structured envelope unchanged to `window.__bridge.request`. Parsing, validation, authorization, idempotency, presentation, and domain execution remain owned by the Frontend command system.
