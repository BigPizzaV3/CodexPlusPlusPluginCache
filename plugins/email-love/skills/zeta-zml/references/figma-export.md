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

## Zeta specifics

**There is no Zeta Marketing Platform export, and that is the most important thing on this page.** The plugin's documented ESP list covers Klaviyo, Braze, Iterable, Customer.io, HubSpot, Salesforce Marketing Cloud, Marketo, ActiveCampaign, Brevo, Mailjet, MailerLite, Postmark, Sailthru, Emarsys, Pardot, SendGrid, SendX, Airship, MoEngage, Netcore, OneSignal, Loops, Blueshift, Stripo and Parcel — and not ZMP. The route for Zeta is **Download as HTML**, described as "the most universal option": "export your email as a standalone HTML file that you can open in a browser, send as a test, or import into any email platform manually." You then import that file into ZMP's **HTML Editor**, which accepts a paste, a URL, or a ZIP whose HTML file is named `index.html`.

**So none of the ESP-specific export handling applies to you.** The unsubscribe convention is the case that matters. The plugin swaps any link pointing at `unsubscribe.com` for the target ESP's unsubscribe tag — but that conversion is documented for "all our out-of-the-box integrations", and ZMP is not one. **Nothing in the plugin's documentation says what an `unsubscribe.com` link produces in a plain HTML download.** Do not assume it becomes a Zeta tag, and do not assume it is left alone. Confirm what your first export actually contains before you send anything from it.

**The safer route is to bring your own tag.** Type Zeta's `{{unsubscribe_link}}` into the link field in Figma and the plugin's stated behaviour is to preserve it: "the plugin recognizes the common unsubscribe tags for each ESP and will preserve yours exactly on export." That sentence is written about known ESPs, so verify it on the export rather than trusting it — but a tag you typed yourself is a much shorter thing to check than a substitution you did not see happen. Zeta's other special links are `{{manage_preferences_link}}`, `{{optin_link}}` and `{{view_email_in_browser_link}}`, and ZMP's HTML Editor can insert all of them from **Insert Special Links** after import.

**And the plugin's authors have done no ESP-specific export testing for this platform**, because there is no integration to test. Every other platform section in this file rests on a documented, exercised export path. This one does not. Treat the first ZMP import as a real test, not a formality: check the footer, the merge tags, and one recipient's rendered output before the campaign is activated.

**A reader who arrived here saying "Zeta" may be on the wrong platform entirely.** Zeta Global ships two email products. Zeta Marketing Platform uses ZML — this skill. **Zeta Engage by Sailthru uses Zephyr**, single-brace `{if}` and `{foreach}`, and the plugin **does** document a Sailthru export: templates via API, with Updatable Templates supported, authenticated with an API key and shared secret pair. If the person's tags look like `{if …}` rather than `{% if … %}`, [the Sailthru export guide](https://help.emaillove.com/plugin/export/sailthru) and the `sailthru-zephyr` skill are the right pair, not this one.

**Single quotes in link fields cost you nothing here.** The link-field truncation trap bites platforms whose own docs use double quotes in filter arguments. ZML pushes you the same way the plugin does: `{% global %}` requires single quotes — "double quotes can cause unexpected output" — and Zeta's own filter examples use both. Write `{{ slug | default: 'home' }}` in a link field and the question never arises.

**Keep ZML comparisons out of text layers.** `{% if points > 500 %}` needs a Code Block, for the reason the shared section gives. ZML makes this easy to forget because so much of it is inline merge tags that genuinely belong in text.

**Declaration order survives export, so get it right in Figma.** `{% feeds include: 'name' %}` must appear above every `{{feeds[…]}}` reference, and `{% media_asset %}` tags built from feed values must appear below the `assign`s that produce them. In a Figma file that ordering is the layer-tree order, not the visual order — a Code Block that looks like it is at the top of the canvas may not be first in the exported HTML.

**`{% assign %}` is not block-scoped**, so a declaration in the **Head of email** field should still be in effect in the body. Zeta does not document that field's equivalent, so verify it once. What definitely has no Figma equivalent is ZMP's **Global Variables** field: `{% global %}` snippets belong there, added in ZMP after import, and "the `assign` tag will not work in the other parts of the message."

**The plugin hosts your images, `{% media_asset %}` hosts Zeta's.** Exports upload images to the Email Love CDN and write those URLs into the HTML. That is a perfectly good answer, and it means the `{% media_asset %}` tag is for assets already in Zeta's Asset Library — not for anything the plugin exported. Do not try to make the two meet.

**`{% skip_message %}` in a Code Block cancels the send silently as far as Figma is concerned** — the design looks complete and the message never arrives. Worse than a Braze abort, because ZML's skip is person-level and takes out every channel in the campaign.

**Watch the 102 KB line.** ZMP's own guidance is to keep HTML under it because Gmail clips above it. Hidden-on-desktop and hidden-on-mobile content both ship in the export, and every conditional branch counts, so a Figma email with several variants gets there faster than it looks.

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
- [Export options overview](https://help.emaillove.com/plugin/export/overview) — the plugin has no Zeta Marketing Platform export guide; use **Download as HTML**

MJML behaviour in this file was compiled and measured on MJML 4.18 rather than inferred.
