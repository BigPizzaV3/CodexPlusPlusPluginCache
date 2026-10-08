# Declarative — tools from existing forms

The WebMCP Declarative API turns a standard HTML `<form>` into a tool by adding
attributes. The browser synthesizes `inputSchema` from controls and handles
fill / focus. Browsers that do not support WebMCP ignore `tool*` attributes;
the form still works for humans.

Chrome: https://developer.chrome.com/docs/ai/webmcp/declarative-api  
Explainer: https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md

## Inventory

Find real `<form>` elements (templates, server-rendered HTML, client components
that still emit `<form>`). Skip click-handler “forms” with no `<form>` — those
need **Imperative**.

For each form, propose to the user:

- Suggested `toolname` (verb + object, ASCII `[a-zA-Z0-9_.-]`)
- One-line `tooldescription` (when to use, what it does)
- Whether `toolautosubmit` is appropriate (low-risk search/filter: often yes;
  purchase/delete/send: usually no — human clicks Submit)
- Fields that need `toolparamdescription` because the `<label>` is vague

Do not annotate every form blindly. Drop captcha-only, password-reset, or
internal debug forms unless the user asks.

## Attributes to add

Form:

| Attribute | Role |
| --- | --- |
| `toolname` | Tool id; removing it unregisters |
| `tooldescription` | Agent-facing purpose; removing it unregisters |
| `toolautosubmit` | Optional boolean; agent may submit without a human click |

Controls:

| Attribute | Role |
| --- | --- |
| `name` | JSON Schema property name (already required for forms) |
| `toolparamdescription` | Property description; else associated `<label>` text, else `aria-description` |
| `required` | Becomes `required` in the synthesized schema |

Radio groups: put `toolparamdescription` on the nearest parent `<fieldset>`.

## Minimal patch

```html
<form
  action="/search"
  method="get"
  toolname="search_catalog"
  tooldescription="Search the product catalog by keyword and show matching results on this page."
  toolautosubmit
>
  <label for="q">Search</label>
  <input
    id="q"
    type="search"
    name="q"
    required
    toolparamdescription="Keywords or product name to search for."
  />
  <button type="submit">Search</button>
</form>
```

## Agent submit vs human submit

- Default: agent fills fields; user reviews and clicks Submit.
- `toolautosubmit`: agent can submit (and navigate) immediately.

`SubmitEvent.agentInvoked` is `true` when an agent triggered submit. Use
`preventDefault()` + `event.respondWith(promise)` to return a JSON-serializable
result to the model instead of a full navigation:

```js
form.addEventListener("submit", (event) => {
  if (!event.agentInvoked) return;
  event.preventDefault();
  event.respondWith(runSearchAndReturnHits());
});
```

Events: `toolactivated` / `toolcancel` on `window` (include `toolName`).
CSS: `form:tool-form-active`, submit control `:tool-submit-active`.

## Done when

- [ ] Each agreed form has `toolname` + `tooldescription`
- [ ] Vague fields have `toolparamdescription`
- [ ] Destructive forms omit `toolautosubmit`
- [ ] DevTools `list_webmcp_tools` shows the forms on the pages they live on
- [ ] One agent execute fills (and optionally submits) a form end to end
