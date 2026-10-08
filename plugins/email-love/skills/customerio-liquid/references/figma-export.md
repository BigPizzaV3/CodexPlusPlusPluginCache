# Personalization in Figma with the Email Love plugin

Applies when someone is designing the email in Figma with the [Email Love plugin](https://www.emaillove.com/figma-plugin) and exporting production HTML from it, rather than pasting code into the ESP.

The plugin compiles the Figma file to MJML and then to HTML. It **does not process, validate, or rewrite your personalization code** — "it simply inserts your templating language as raw code into the exported HTML" ([dynamic content](https://help.emaillove.com/plugin/components/dynamic-content)). So every rule in the rest of this skill still applies unchanged. What changes is *where the code goes*, and a small number of Figma-specific failure modes that have no equivalent when you author in the ESP.

## Where code can go

| Where | Reach for it when | Selected layer |
|---|---|---|
| **A text layer** — type the tag straight into the Figma text | An inline value inside a sentence. Merge tags, defaults, anything that opens and closes inside one text layer | any text layer |
| **A Code Block** (`mj-raw`) — Assets tab → **Code** → paste → **Add Custom Code** | Anything structural: conditionals and loops that wrap content, snippet/content-block references, tracking pixels, live-content embeds | inserts at the selected position |
| **A link field** — Properties tab, or the **Links included in your email** list on the email frame | A merge tag as a link destination: unsubscribe, preference centre, view-in-browser, a per-recipient URL | `mj-image-Frame`, `mj-button-Frame`, an `mj-wrapper` set to render as an image, or the email frame for the list |
| **Head of email** — Properties / Template settings | Raw HTML/CSS injected into the email's `<head>`: head CSS that a snippet or content block depends on, and — where the language has a declaration form that survives outside the body — variable declarations. See the platform section below for whether yours does | template-level |

Two more fields carry code and are easy to miss. **Override image source** on an `mj-image-Frame` takes "your dynamic image URL or merge tag" — a Nifty Images URL, an ESP-generated one, a countdown timer. And a **wrapper** can carry a URL too, though only once you have set it to render as an image.

The plugin's docs do not say whether the **subject** and **preheader** fields accept merge tags. They are ordinary text fields writing into the exported HTML, so they almost certainly do; confirm it on a first send rather than taking it from here.

## The nesting rule

This is the one that ships broken emails, and it is worth stating before anything else.

The plugin documents three placements for a Code Block ([raw code component](https://help.emaillove.com/plugin/raw-code/overview)):

- **Between wrappers** — wraps whole wrapper blocks
- **Between sections inside a wrapper** — wraps rows
- **Inside a column** — inline with text, images, and buttons

> "When using conditional logic (if/else), make sure your opening tag and closing tag are at the **same nesting level**. If your opening `{% if %}` is between wrappers, your closing `{% endif %}` must also be between wrappers, not inside a column."

**Why it matters, and it is worse than it sounds.** MJML emits each child of a container as a complete unit — a whole section table plus its Outlook conditional comments, or a whole `<tr>` inside a column. Two Code Blocks that are siblings therefore always have a whole number of complete units between them, so whatever the condition removes, the surrounding markup stays balanced. Two Code Blocks at *different* levels do not.

Compiled and measured on MJML 4.18. Opening tag in a two-column section's column, closing tag in a later wrapper's column, condition false:

```
orphaned </table> × 3   orphaned </tr> × 3   orphaned </td> × 3
Outlook conditional-table depth: -2      (must be 0)
```

The same test with both Code Blocks as siblings — wrapping a two-column section, a wrapper, and a full-width section all at once — comes back balanced on every tag and depth 0. Sibling placement is safe regardless of how different the blocks between them are; cross-level placement is not, regardless of how similar they look.

The failure is also close to invisible. The condition is true in your test send, so nothing looks wrong. It only breaks for the recipients who take the other branch, and it breaks worst in Outlook, which is where nobody is looking.

**Nothing warns you.** "Code inside mj-raw frames is not checked for syntax errors." The plugin's preview does not render Code Blocks at all, and neither does the Figma canvas — "The Raw Code Component appears as a placeholder frame in Figma."

## Mapping constructs to placement

| What you're writing | Where it goes |
|---|---|
| A merge tag inside a sentence | The text layer |
| A default/fallback that opens and closes in one string | The text layer |
| A conditional around a whole row or band | Paired Code Blocks **between sections**, or between wrappers |
| A conditional around one element inside a row | Paired Code Blocks **inside that column** |
| A loop over catalog or cart items | Paired Code Blocks with the repeating design between them, the whole structure wrapped "in a table or column" |
| An `else` branch | A third Code Block. The docs only require the *opening and closing* tags to match levels, but keeping all three siblings is the only arrangement that is safe by construction |
| A snippet or content-block reference | A single Code Block, wherever the block should appear |
| A tracking pixel | A single Code Block "at the bottom of your email (inside the last section)" |
| A declaration that must be in place before the body renders | The **Head of email** field, if the language has one that works from there |
| A link destination that is a merge tag | The link field, not a Code Block — unless the rule below applies |

For loops the plugin's own instruction is to "wrap this entire structure in a table or column," which is the same rule arrived at from the other direction: the opening tag, the repeating design, and the closing tag all live inside one container, so MJML repeats a whole number of complete units — `<tr>` rows, in the column case.

## Traps

**Double quotes inside a link field silently truncate the link.** A link destination becomes an MJML attribute, and MJML delimits attributes with double quotes. At MJML's default validation level a destination of `https://x.com/{{ slug|default:"home" }}` compiles without an error and ships as:

```html
href="https://x.com/{{ slug|default:"
```

Verified on MJML 4.18: strict validation raises `Attributes home", }}" are illegal`; soft validation — the default — truncates and says nothing. **Use single quotes for every string argument inside a link field**, or build the whole `<a>` element in a Code Block instead. This bites hardest on the platforms whose own documentation uses double quotes in filter arguments.

**Keep `<` and `>` out of text layers.** A comparison like `{% if score > 5 %}` typed into a Figma text layer passes through a step the plugin's documentation is silent about — nothing states that text-layer characters are escaped, and nothing states that they aren't. Code Blocks are documented as exact passthrough. Put any comparison operator in a Code Block and the question never arises.

**Unsubscribe is matched on the link, not the words.** The plugin looks for any link pointing at `unsubscribe.com` and swaps it for the target ESP's unsubscribe tag — "The link is what matters, not the text around it." A footer that *says* "Unsubscribe" but links nowhere converts to nothing. Conversely, a button labelled "Manage preferences" that points at `unsubscribe.com` becomes the **unsubscribe** tag, not a preference-centre link. Type your ESP's own tag into the link field instead and the plugin preserves it as written.

**Figma refuses merge tags as hyperlinks, and there is a documented way round it.** Give the text an ordinary placeholder link in Figma first — that is what makes it appear in the list — then open **Links included in your email** on the email frame and replace the URL with the tag. "The plugin stores the tag itself and swaps it in at export, so the exported HTML contains the tag while your Figma file keeps the placeholder." Text with no link never appears in the list at all.

**The Links list validates what you type, and it is friendlier than it sounds.** "Web URLs, `mailto:` and `tel:` links, `#` anchors, and ESP merge tags are all accepted"; anything it does not recognise raises *"Please enter a valid URL or merge tag"* and the change is not applied. The merge-tag shapes it names as common are `{{ var }}`, `{% var %}`, `*|VAR|*`, `%%VAR%%`, `{var}`, `%VAR%`, `${var}`, `<<VAR>>`, `[VAR]`. That is an illustrative list rather than a documented whitelist, so a block helper or a multi-tag expression may or may not pass. Build those in a Code Block as a complete `<a>` element and the question does not arise.

**Three things the plugin does to URLs.** In the Links list, bare domains are completed to `https://`, "so your exported HTML never contains a relative link." Where you type an unsubscribe merge tag into a link field, "Figma may automatically add `https://` in front of your tag… The plugin removes it for you on export" — documented for that case; do not assume it generalises to every merge tag in every field. And UTM parameters set on the email frame are appended to every URL in the email but **never to a merge tag**: "A campaign UTM setting won't corrupt `{{unsubscribe_url}}` into `{{unsubscribe_url}}?utm_...`."

**Code Blocks skip MJML entirely.** "It won't automatically become responsive or gain email client compatibility fixes." And because a Code Block is not a plugin node, the per-node mobile and dark-mode settings have nothing to attach to — template-level Mobile CSS still reaches it, per-element overrides do not. That is the point of them, and it is also why the plugin's own advice is to keep them minimal. Design the repeating content in a loop with real components; use the Code Block only for the loop tags themselves.

**Paste code into the Properties tab, not into a Figma text layer inside the Code Block frame.** "The plugin reads from the Properties panel, not from visual content on the canvas." This is the first thing to check when a Code Block exports empty.

**Hidden content still ships.** "Show/Hide on Desktop & Mobile still includes both versions in the HTML" ([troubleshooting](https://help.emaillove.com/plugin/getting-started/troubleshooting)). Combined with conditional branches, an email with several variants can approach Gmail's 102KB clipping threshold faster than it looks.

## Customer.io specifics

**The engine is chosen in Customer.io, per message — not in Figma.** Customer.io runs two Liquid engines, legacy Ruby and the current LiquidJS, and the setting lives on the message. The same exported HTML therefore behaves differently depending on which message you paste or push it into. Nothing in the Figma file records which engine you designed for, so say it explicitly in your handoff. This is the single most common way Customer.io work goes wrong, and Figma makes it easier to lose track of, not harder.

**The Customer.io export converts to native Design Studio components, which makes Code Block placement worth checking once.** The plugin maps your design onto `x-section`, `x-row`, `x-cta`, `x-image` and friends so the email stays editable in the Design Studio editor. That is a genuinely useful property — and it is also the one export in this set that rewrites structure rather than emitting the compiled HTML directly. Open the result in Design Studio the first time and confirm your paired Code Blocks are still siblings before you trust the pattern for a whole design system.

**`{{snippets.footer_legal}}` goes in a Code Block.** It is a variable reference, not a tag — Customer.io has no `{% snippet %}` tag, and a snippet name containing a space needs bracket notation, `{{snippets["main address"]}}`. Those double quotes are fine in a Code Block and would truncate a link field — as would the double quotes in Customer.io's own documented `default: "there"`. Use single quotes in a link field.

**Liquid `{% assign %}` is not block-scoped**, so a declaration in the **Head of email** field is still in effect in the body — one of the few places the field earns its keep for something other than CSS.

**The unsubscribe token the plugin emits is an open question, and it matters.** Email Love's [Customer.io export documentation](https://help.emaillove.com/plugin/export/customerio) says the Email Love Footer's unsubscribe link "is replaced with Customer.io's `{{unsubscribe_url}}` token automatically", and that without a footer "the plugin has nothing to swap Customer.io's `{{unsubscribe_url}}` token into". But `{{unsubscribe_url}}` is the variable form, and Customer.io documents the tag form — its own material states that the variable "will render as empty text". If the plugin emits what its documentation describes, a Figma-exported Customer.io email ships an empty unsubscribe link.

We have not been able to test this end to end. **Open the exported HTML on your first Customer.io export and look at what is actually in the footer's `href`.** If it reads `{% unsubscribe_url %}`, the export is correct and only the help article is wrong. If it reads `{{unsubscribe_url}}`, replace it before you send and report it, because every export has the same problem. Either way, the export still fails without an Email Love Footer carrying an unsubscribe link.

**Overwrite existing template is the upsert, and it is fragile in a specific way.** Toggling it makes the plugin `PUT` a new version of the email it previously created *from this Figma frame*. Rename the frame or point at a different workspace and you silently get a new email instead. Treat Figma as the source of truth and re-export rather than editing HTML in Customer.io.

**Images go to Customer.io's own asset library**, 3MB per file, BMP/JPEG/PNG/GIF. A single image failing does not fail the export — which means a broken image can ship quietly.

**Two things the baseline will tell you Customer.io cannot do, that it can.** Rendering a time in the recipient's timezone is an argument on the `date` filter, not a hand-rolled offset table. Reaching a person's related objects is `objects.<plural>[n]`, not an engineering workaround. Both matter more in a Figma workflow, because the wrong answer arrives as a large block of hand-written markup in a Code Block — which skips MJML entirely and is where cross-client rendering breaks.

**Mixed per-side borders have no Design Studio equivalent** and export as inline styles that may land on the inner column rather than the section box. Not a personalization issue, but it is the one structural thing the Customer.io export is documented to get approximately right rather than exactly right.

## Before you export

1. Every Code Block that opens something has a matching Code Block that closes it, **at the same nesting level**. Walk the Figma layer tree, not the canvas — the canvas gives you no signal.
2. Every string argument inside a link field uses single quotes.
3. No `<` or `>` in any text layer.
4. Every merge tag has a default value. This is the plugin's own house rule and it is a good one: "Always include a default value in your merge tags."
5. The unsubscribe link is present and correct for the target ESP.
6. Then test in the ESP against dedicated seed or test records — never production recipients — on both branches of every conditional and with zero, one, and many items in every loop. The plugin cannot tell you any of this — its preview does not render Code Blocks, and it does not validate the code inside them.

## Sources

- [Personalize your email content with dynamic content](https://help.emaillove.com/plugin/components/dynamic-content)
- [Using the Raw Code Component](https://help.emaillove.com/plugin/raw-code/overview)
- [The Properties Tab](https://help.emaillove.com/plugin/email-properties/properties-tab)
- [Unsubscribe Links](https://help.emaillove.com/plugin/links/unsubscribe)
- [Use an External Image URL](https://help.emaillove.com/plugin/images/external-images)
- [Set default custom code for every new template](https://help.emaillove.com/plugin/styling/persistent-custom-code)
- [Export Figma emails to Customer.io](https://help.emaillove.com/plugin/export/customerio)

MJML behaviour in this file was compiled and measured on MJML 4.18 rather than inferred.
