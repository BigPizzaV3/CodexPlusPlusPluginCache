# Verification / dogfood

Treat WebMCP tools like a public API: they are done when an agent can call them.

## Chrome DevTools MCP (preferred)

Requires a Chromium build that exposes WebMCP to DevTools (Chrome Dev 145+ /
Canary recommended for authenticated sessions).

1. Start or attach the browser; open the target URL.
2. Call `list_webmcp_tools`.
3. Confirm:
   - Expected tools are present (and stale ones are gone after navigation)
   - Names match the design
   - Schemas look right
4. For each tool, call `execute_webmcp_tool` with:
   - `toolName`: exact name
   - `input`: **JSON string** of arguments, e.g. `"{\"query\":\"webmcp\"}"`
5. Assert UI state + return payload:
   - Declarative (forms): fields filled, `:tool-form-active` / submit as designed
   - Imperative (dedicated path): the agreed UI/state outcome (e.g. landed on
     checkout last step, store updated)
   - Bridge (`webmcp-proxy`): JSON/result from MCP; **no** DOM fill expected
6. Re-test after route changes (register/abort lifecycle).

### Failure cheatsheet

| Symptom | Likely cause |
| --- | --- |
| Empty tool list | No `modelContext`, polyfill not initialized, wrong origin, tools not mounted |
| Tool missing after nav | Abort on unmount without re-register on new page |
| Execute errors | Invalid JSON `input`, schema mismatch, throw in `execute` |
| Null / failed result | Non-JSON-serializable return, rejected promise |
| Duplicate name error | Registered twice without aborting the first |

## Manual console

```js
const mc = document.modelContext ?? navigator.modelContext;
const tools = await mc.getTools();
console.log(tools.map((t) => t.name));

const tool = tools.find((t) => t.name === "search_docs");
await mc.executeTool(tool, { query: "webmcp" });
```

## Definition of done

- [ ] Feature detection does not break browsers without WebMCP
- [ ] Happy-path execute works via DevTools MCP or `executeTool`
- [ ] Mutating tools are annotated and tested with real side effects
- [ ] Abort on unmount removes tools from `list_webmcp_tools` / `getTools`
- [ ] Errors returned to the agent are actionable (no silent empty failures)
