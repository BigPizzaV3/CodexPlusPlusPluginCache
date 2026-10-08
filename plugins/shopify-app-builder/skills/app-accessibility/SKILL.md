---
name: app-accessibility
description: "Use when auditing or building accessibility in a Shopify embedded app — WCAG 2.1 AA, keyboard navigation, focus management in Modal/SaveBar/ResourcePicker, screen reader support (NVDA/JAWS/VoiceOver), color contrast within Polaris tokens, ARIA usage, alt text, i18n + a11y, and Built for Shopify accessibility gates. Triggers: 'accessibility shopify app', 'a11y shopify', 'WCAG 2.1 AA', 'screen reader shopify', 'keyboard nav shopify app', 'focus management modal', 'polaris contrast', 'color contrast shopify', 'aria label polaris', 'shopify accessibility audit', 'built for shopify accessibility'."
---

# Shopify Embedded App Accessibility (WCAG 2.1 AA)

Accessibility is a Built for Shopify gate and a legal requirement (ADA Title III, European Accessibility Act took effect 2025-06-28). Audited apps fail BFS review when keyboard navigation breaks inside iframes, focus indicators are stripped, alt text is missing on product imagery, or color contrast drops below 4.5:1. This skill is the checklist for every embedded app feature.

## 1. When to Use

Trigger this skill when:

- Building any new screen, Modal, SaveBar, or form in an embedded app
- Auditing an existing app before Built for Shopify submission
- Investigating a merchant complaint about keyboard or screen reader usage
- Reviewing a PR that touches focus, ARIA, color, or alt text
- Deciding whether to override a Polaris token (almost never — see Section 6)
- Adding i18n / RTL support that touches reading order, aria-label strings, or lang attributes
- Pairing with `polaris-ui` (component usage) or `app-bridge` (Modal/SaveBar) — this skill is the a11y overlay on top of both

Do NOT use this skill for storefront / theme accessibility — that is a separate domain (`shopify.dev/docs/storefronts/themes/best-practices/accessibility`).

## 2. WCAG 2.1 AA Criteria Applied to Shopify Apps

Shopify Polaris targets WCAG 2.1 A and AA by default. Embedded apps inherit that baseline only if you use Polaris components correctly and do not override semantics, contrast, or focus. The criteria that matter most for admin apps:

**Perceivable**

- 1.1.1 Non-text Content (A) — every image, icon-only button, and chart needs a text alternative
- 1.3.1 Info and Relationships (A) — use semantic HTML; `<Text as="h2">` not `<Text variant="headingMd">` on a paragraph
- 1.3.5 Identify Input Purpose (AA) — use `autoComplete` on email, name, address, tel inputs
- 1.4.3 Contrast Minimum (AA) — 4.5:1 for text under 18pt, 3:1 for large text
- 1.4.11 Non-text Contrast (AA) — 3:1 for form borders, focus rings, icons that convey state
- 1.4.10 Reflow (AA) — content must reflow at 320 CSS px width; no horizontal scroll inside the iframe
- 1.4.12 Text Spacing (AA) — line height 1.5x font-size, paragraph spacing 2x; Polaris defaults pass

**Operable**

- 2.1.1 Keyboard (A) — every interactive element reachable and operable via keyboard
- 2.1.2 No Keyboard Trap (A) — except in Modal, focus must be able to leave any region
- 2.4.3 Focus Order (A) — DOM order matches visual order; do not reorder with positive `tabindex`
- 2.4.7 Focus Visible (AA) — never set `outline: none` without a replacement
- 2.5.5 Target Size (AAA, but BFS-watched) — interactive targets at least 44x44 CSS px

**Understandable**

- 3.1.1 Language of Page (A) — `<html lang="en">` set at the embedded app's HTML root, not the Shopify admin's
- 3.2.2 On Input (A) — changing a `<Select>` value must not auto-submit or auto-navigate
- 3.3.1 Error Identification (A) — TextField `error` prop populated; never rely on red border alone
- 3.3.2 Labels or Instructions (A) — every TextField has a non-empty `label`

**Robust**

- 4.1.2 Name, Role, Value (A) — custom widgets must expose accessible name + role + state
- 4.1.3 Status Messages (AA) — Toasts and Banners must be announced (Polaris Toast uses `role="status"` automatically)

## 3. Top 20 Accessibility Failures in Embedded Apps

| # | Failure | Fix |
|---|---------|-----|
| 1 | Icon-only Button with no label | `<Button icon={DeleteIcon} accessibilityLabel="Delete product" />` |
| 2 | Image with empty/missing alt | `<img src={url} alt="Product hero photo of red sneaker" />` or `alt=""` for decoration |
| 3 | TextField with no `label` prop | Always set `label`; use `labelHidden` if hiding visually |
| 4 | `<div onClick>` for interactive element | Use `<Button variant="plain">` instead |
| 5 | Color alone conveys state (red border = error) | Pair color with `error="Email is required"` text + icon |
| 6 | Modal opens but focus stays on trigger | Polaris Modal handles this — do not override; do not roll your own |
| 7 | Modal closes but focus does not return | Same — let Polaris Modal manage it; never call `.focus()` manually inside `onClose` |
| 8 | `outline: none` stripped from focus ring | Remove the rule; or replace with `outline: 2px solid var(--p-color-border-focus); outline-offset: 2px;` |
| 9 | Positive `tabindex="3"` to reorder | Delete the tabindex; restructure DOM |
| 10 | `<h1>` then `<h4>` (skipped heading levels) | Use `<Text as="h1">`, `<Text as="h2">` in DOM order |
| 11 | Toast for a critical error message | Use `<Banner tone="critical">` (persistent) instead — Toasts auto-dismiss |
| 12 | Loading spinner with no accessible name | `<Spinner accessibilityLabel="Loading products" />` |
| 13 | Tooltip is the only place help text lives | Move to `helpText` prop on TextField; tooltip can supplement |
| 14 | IndexTable row click but no row label | `<IndexTable.Row id={id} position={i}>` plus row content with names |
| 15 | Form submits on Enter but no submit button | Add a visible `<Button submit>Save</Button>` for screen reader users |
| 16 | Color contrast 3.5:1 on subdued text | Use `tone="subdued"` only on small non-essential text; never below 4.5:1 for body |
| 17 | Animated Banner / Toast with no `prefers-reduced-motion` respect | Polaris respects it; do not add your own keyframe animations |
| 18 | ResourcePicker invoked from a non-button element | Trigger from `<Button>` so screen reader announces it as a button |
| 19 | iframe missing `title` attribute | `<iframe title="Shopify product import preview" ...>` |
| 20 | App HTML has no `lang` attribute | Add `<html lang="en">` (or merchant's locale) to the embedded app root |

## 4. Keyboard Navigation

### Focus Trap in Modal

Polaris `<Modal>` and App Bridge `<ui-modal>` both implement focus trap automatically. When the modal opens, focus moves to the modal container (or the first focusable element). Tab cycles through focusable elements inside the modal only. Shift+Tab cycles backward. Escape closes the modal. Click on the backdrop closes. Do not write your own focus trap — you will diverge from Polaris and confuse screen readers.

```tsx
import { Modal, TextField } from '@shopify/polaris';

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit Product"
  primaryAction={{ content: 'Save', onAction: handleSave }}
  secondaryActions={[{ content: 'Cancel', onAction: () => setIsOpen(false) }]}
>
  <Modal.Section>
    <TextField label="Product name" value={name} onChange={setName} autoFocus />
  </Modal.Section>
</Modal>
```

Notes:
- `title` becomes `aria-labelledby` automatically
- `autoFocus` on the first input is allowed and recommended
- Do NOT add `aria-modal="true"` manually — Polaris already does

### Focus Return on Close

When the Modal closes, Polaris returns focus to the trigger element automatically. This works only if:

- The trigger is still mounted (do not unmount the trigger button while Modal is closing)
- You did not call `.blur()` on the trigger before opening the Modal
- You did not move focus elsewhere in `onClose`

If the trigger is dynamic (inside a table row that may have unmounted), use a `useRef` to a stable wrapper:

```tsx
const triggerRef = useRef<HTMLButtonElement>(null);
// pass triggerRef.current to focus on close if needed
```

### Save Bar Focus

App Bridge `<ui-save-bar>` and Polaris `<ContextualSaveBar>` are not modal — they do not trap focus. Save / Discard are reachable via Tab from the form. Two rules:

1. The save bar's primary action must be reachable without leaving the form (do not place the save bar in a portal that breaks Tab order)
2. After Save success, focus should return to the form area (not jump to `<body>`). If you re-render the page, place focus on the page heading:

```tsx
const headingRef = useRef<HTMLHeadingElement>(null);

const handleSaveSuccess = () => {
  shopify.toast({ title: 'Saved' });
  headingRef.current?.focus();
};

<h1 ref={headingRef} tabIndex={-1}>Product settings</h1>
```

The `tabIndex={-1}` makes it programmatically focusable without inserting it into the Tab order.

### Resource Picker Focus

`shopify.resourcePicker()` and `<ui-resource-picker>` are full-screen overlays rendered by the Shopify admin (not your iframe). Shopify handles focus inside the picker. Your responsibility:

- The trigger must be a `<Button>` (announced as button by screen readers)
- After `onSelection` or `onCancel`, focus should return to the trigger; Shopify usually does this — if not, focus the trigger manually

```tsx
const pickerTriggerRef = useRef<HTMLButtonElement>(null);

const openPicker = async () => {
  await shopify.resourcePicker({
    type: 'product',
    onSelection: (resources) => {
      setSelected(resources.selection);
      pickerTriggerRef.current?.focus();
    },
    onCancel: () => pickerTriggerRef.current?.focus(),
  });
};
```

### Tab Order Rules

- Visual order must match DOM order
- Never use `tabindex` greater than 0
- `tabindex="0"` to make a non-interactive element focusable (rare — use a Button instead)
- `tabindex="-1"` to make an element programmatically focusable but skipped by Tab (page headings after navigation)

## 5. Screen Reader Testing

Test every release on at least one screen reader. Two minimum combos cover ~80% of the market:

| Screen Reader | OS | Browser | Cost |
|---------------|-----|---------|------|
| NVDA | Windows | Firefox or Chrome | Free |
| VoiceOver | macOS | Safari | Built in |
| JAWS | Windows | Chrome | Paid (skip unless enterprise) |

**Minimum coverage: NVDA on Firefox AND VoiceOver on Safari.**

### What to Test

For every page or modal:

1. Page load — does the screen reader announce the page heading?
2. Heading navigation (H key in NVDA, VO+Cmd+H in VoiceOver) — heading levels are sensible and ordered
3. Form fields — each TextField announces its label, required state, error message, help text
4. Buttons — every button has a non-empty accessible name (no "Button" alone)
5. Tables — IndexTable rows announce row position and content
6. Modal open — title is announced, focus is inside the modal, Escape closes
7. Toast — success messages are announced; critical errors use Banner instead
8. Live regions — Banner / Toast updates do not interrupt the user mid-sentence

### Quick NVDA Cheat Sheet

- Start: `Ctrl + Alt + N`
- Stop speech: `Ctrl`
- Read next line: `Down`
- Read element: `NVDA + Tab`
- Headings list: `Insert + F7`
- Browse mode toggle: `NVDA + Space`

### Quick VoiceOver Cheat Sheet

- Start / stop: `Cmd + F5`
- VO key: `Ctrl + Option`
- Move next: `VO + Right`
- Open rotor (headings, links, forms): `VO + U`
- Read element: `VO + A`

## 6. Polaris Color Contrast Tokens

Polaris colors are generated in HSLuv to guarantee WCAG 2.1 AA contrast. Use semantic tokens. Never hardcode hex values for text or interactive elements.

### Safe text tokens (4.5:1+ against `bg-surface`)

- `--p-color-text` — primary body text
- `--p-color-text-subdued` — secondary text; still passes 4.5:1 on bg-surface but fails on bg-surface-secondary in some themes — measure
- `--p-color-text-critical` — error text
- `--p-color-text-success` — success text
- `--p-color-text-warning` — warning text
- `--p-color-text-inverse` — text on dark fills

### Safe interactive tokens (3:1+ for borders and icons)

- `--p-color-border` — form borders
- `--p-color-border-focus` — focus rings
- `--p-color-icon` — neutral icons
- `--p-color-icon-subdued` — only on icons that have a visible text label nearby

### Tokens to NEVER override below contrast

| Token | Minimum ratio | Notes |
|-------|---------------|-------|
| `--p-color-text` | 4.5:1 | Body copy. Override only if you re-measure. |
| `--p-color-text-critical` | 4.5:1 | Error messages. |
| `--p-color-border-focus` | 3:1 | Focus ring against surface AND against fill — must pass on both. |
| `--p-color-border` | 3:1 | Form borders against the surface they sit on. |

### When You Must Use Brand Color

If product owner wants a custom brand color on a Button or Banner accent:

1. Run the candidate color through a contrast checker against `--p-color-bg-surface` (light) AND its dark theme equivalent if Shopify admin dark mode is enabled
2. Aim for 4.5:1 on text, 3:1 on borders / icons
3. If it fails, darken until it passes — do not ship a failing color

Polaris ships some yellow tones that are marginal on light backgrounds. For warning text always use `--p-color-text-warning`, not raw yellow hex.

## 7. ARIA — When Needed, When Polaris Covers It

The first rule of ARIA: do not use ARIA if a native HTML element exists. The second rule: if Polaris renders an element, it already wires the ARIA. Do not double-aria.

### Already Handled by Polaris (do NOT add yourself)

| Polaris Component | ARIA it sets | Do not duplicate |
|-------------------|--------------|------------------|
| `<Modal title="X">` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Adding `role="dialog"` to a child div is wrong |
| `<TextField label="X" error="Y">` | `aria-labelledby`, `aria-invalid`, `aria-describedby` | Adding `aria-label` on top of `label` is wrong |
| `<Button>` | `role="button"` (it IS a button) | Adding `role="button"` to a Polaris Button is redundant |
| `<Banner>` | `role="status"` or `role="alert"` based on tone | Adding `aria-live` manually breaks announcements |
| `<Toast>` | `role="status"` + live region | Do not wrap in your own `aria-live` |
| `<Tabs>` | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` | Hand-rolled tabs are an anti-pattern |
| `<Checkbox>` / `<RadioButton>` | `role="checkbox"`/`"radio"`, `aria-checked` | Use the component |
| `<Spinner accessibilityLabel="X">` | `role="status"`, `aria-label` | Always provide accessibilityLabel |

### Where You Must Add ARIA Yourself

1. **Icon-only Buttons** — `accessibilityLabel` prop:
   ```tsx
   <Button icon={DeleteIcon} accessibilityLabel="Delete product" />
   ```
2. **ResourceItem** — `accessibilityLabel` prop describing the row action:
   ```tsx
   <ResourceItem id={id} accessibilityLabel={`View ${product.title}`} />
   ```
3. **Custom widgets** — if you must build a custom dropdown, accordion, or combobox (consider redesigning with Polaris first), follow the WAI-ARIA Authoring Practices pattern exactly
4. **Page heading after route change** in SPA — set `tabIndex={-1}` and call `.focus()`
5. **Decorative images** — `alt=""` (empty alt, never missing)
6. **Informative images** — `alt="Descriptive sentence under 125 chars"`
7. **iframes you create** — `title="..."` (browser screen readers announce this)

## 8. Internationalization + Accessibility

Embedded apps support multiple merchant locales. Accessibility strings localize too.

### `lang` Attribute

Set on the embedded app's HTML root, matching the merchant's locale (you can read it from `shopify.config.locale` or the `locale` URL param):

```html
<html lang="fr-CA">
```

If a section of content is in a different language than the page, mark it:

```html
<p>The product is <span lang="ja">商品</span>.</p>
```

This lets screen readers switch pronunciation engine.

### RTL Support

For Arabic and Hebrew merchants, set `dir="rtl"` on the HTML root. Polaris supports RTL via the `AppProvider`'s i18n object. Mirror:

- Layout direction (Polaris handles this in CSS)
- Icons that imply direction (`ChevronRightIcon` should flip to `ChevronLeftIcon`)
- Reading order in custom layouts

### Localized Accessibility Strings

`accessibilityLabel`, `helpText`, `error`, `label` props all accept strings — pass them through your i18n library:

```tsx
<Button icon={DeleteIcon} accessibilityLabel={t('product.delete.label')} />
<TextField label={t('product.name.label')} helpText={t('product.name.help')} />
```

Never concatenate strings ("Delete " + product.title) — pluralization and word order vary by locale. Use ICU message format.

### Locale-aware Screen Reader Strings

For Toasts and Banners, run the message through i18n before passing to `shopify.toast({ title, message })`. The admin's screen reader uses the merchant's locale; mismatched language makes the announcement unintelligible.

## 9. Built for Shopify Accessibility Gates

Built for Shopify certification reviews accessibility. As of the 2026 review criteria the gates that block approval are:

1. **Keyboard navigation works on every interactive element** — Tab reaches everything, Enter / Space activates, Escape closes overlays
2. **Visible focus indicator on every focusable element** — no `outline: none` without a replacement
3. **Color contrast 4.5:1 on text, 3:1 on UI components** — measured at the default Shopify admin theme
4. **All form inputs have labels** — visible or `labelHidden`, never absent
5. **Modal focus management works** — focus enters on open, traps inside, returns on close
6. **Icon-only buttons have accessible names** — `accessibilityLabel` populated
7. **Images have alt text or `alt=""`** — never missing
8. **No keyboard traps outside Modal** — Tab can always leave a region
9. **Page has a `<h1>`** and heading levels are not skipped
10. **Status messages are announced** — Toasts and Banners use Polaris components, not custom `<div>`

BFS auditors test with NVDA + Firefox and VoiceOver + Safari. Apps fail review if they break these on the primary user flows (install, onboard, core feature).

Always re-check the current criteria at shopify.dev/docs/apps/launch/built-for-shopify before submitting — Shopify updates the bar.

## 10. Common Fixes Table

| Issue | Fix Code |
|-------|----------|
| Icon-only Button | `<Button icon={EditIcon} accessibilityLabel="Edit product" />` |
| Decorative image | `<img src="..." alt="" role="presentation" />` |
| Informative image | `<img src="..." alt="Customer order shipped in branded box" />` |
| TextField needs hidden label | `<TextField label="Search" labelHidden value={q} onChange={setQ} />` |
| Page heading after route change | `<h1 ref={r} tabIndex={-1}>Title</h1>` then `r.current?.focus()` |
| Replace `outline: none` | `outline: 2px solid var(--p-color-border-focus); outline-offset: 2px;` |
| Loading spinner | `<Spinner accessibilityLabel="Loading orders" size="large" />` |
| Error not visible to SR | `<TextField label="Email" error="Email is required" value={v} onChange={setV} />` |
| Custom dropdown | Replace with `<Select>` or `<Combobox>` from Polaris |
| Modal without title | Always pass `title` prop — used for `aria-labelledby` |
| Toast for critical error | Replace with `<Banner tone="critical" title="...">...</Banner>` |
| Heading level skip | Use `<Text as="h2">`, `<Text as="h3">` in order |
| ResourceItem unclear | `<ResourceItem id={id} accessibilityLabel={`Open order ${order.name}`} />` |
| iframe missing title | `<iframe title="Product preview" src={url} />` |
| Form has no submit button | Add `<Button submit>Save</Button>` even if SaveBar exists |
| Color-only state on Badge | `<Badge tone="critical">Failed</Badge>` (text + tone, not tone alone) |
| HTML root no lang | `<html lang={merchantLocale}>` at template / index.html |
| Decoration icon announced | `<Icon source={DotIcon} accessibilityLabel="" />` or wrap with `aria-hidden="true"` |
| Long form needs structure | Use `<FormLayout.Group>` to group related fields |
| Disabled button with no reason | Add `helpText` near the trigger explaining why |

## 11. Twenty A11y Rules for Our Plugin

1. Wrap every embedded app in `<AppProvider i18n={...}>` and `<Frame>` if you need toasts and loading
2. Use Polaris components for every interactive element — Button, TextField, Select, Modal, Banner, Toast
3. Never set `outline: none` on any focusable element without an equivalent visible replacement
4. Every Button that has only an icon must set `accessibilityLabel`
5. Every TextField, Select, Checkbox, RadioButton must have a non-empty `label` (use `labelHidden` to hide visually)
6. Every image gets an `alt` attribute — `alt=""` for decoration, descriptive sentence for content
7. Use semantic heading levels — `<Text as="h1">` once per page, then h2, h3 in order
8. Use `<Banner tone="critical">` for persistent critical errors, `<Toast>` for transient success
9. Validate forms inline with the `error` prop; never rely on color alone
10. Test color contrast at 4.5:1 minimum for text; use Polaris tokens, never hardcode hex for text
11. Trigger Modal from a `<Button>`; let Polaris handle focus trap and return
12. Trigger ResourcePicker from a `<Button>`; restore focus to trigger after `onSelection` / `onCancel`
13. After SPA navigation, focus the new page heading with `tabIndex={-1}` + `.focus()`
14. Set `lang` on the HTML root matching the merchant's locale
15. Localize every user-facing string including `accessibilityLabel`, `helpText`, `error`
16. Never use a positive `tabindex` value; never reorder DOM with CSS in a way that breaks Tab order
17. Test every release with NVDA on Firefox AND VoiceOver on Safari
18. Run `axe-core` or `@axe-core/react` in development; fail CI on critical violations
19. Document any Polaris override in a comment with the contrast ratio measured
20. Reserve `aria-*` attributes for cases Polaris does not cover; never double-aria a Polaris element

## 12. Test Checklist

Pre-merge a11y checklist:

- [ ] All interactive elements reachable via Tab in DOM order
- [ ] Visible focus indicator on every focusable element
- [ ] Escape closes every Modal
- [ ] Focus returns to trigger after Modal closes
- [ ] Every Button with an icon-only has `accessibilityLabel`
- [ ] Every TextField / Select / Checkbox has a `label`
- [ ] Every image has `alt` (empty for decoration, descriptive otherwise)
- [ ] No `outline: none` without replacement
- [ ] Page has exactly one `<h1>` and no skipped heading levels
- [ ] Color contrast 4.5:1 on text, 3:1 on borders / icons (sampled with browser devtools)
- [ ] Forms validate inline with `error` prop, not color alone
- [ ] Critical errors use `<Banner>`, not `<Toast>`
- [ ] `lang` attribute set on HTML root
- [ ] axe-core run shows zero critical or serious violations
- [ ] Manual NVDA + Firefox pass on the core happy path
- [ ] Manual VoiceOver + Safari pass on the core happy path
- [ ] Keyboard-only walkthrough of install, onboard, and primary feature
- [ ] Screen at 320 CSS px width — no horizontal scroll inside the iframe
- [ ] Text resize at 200% — no clipped content
- [ ] `prefers-reduced-motion` respected (Polaris does this by default — verify no custom keyframes)
- [ ] Every accessibilityLabel and helpText is in the merchant's locale

## 13. Decision Tree

```
Building a new UI element?
│
├── Is there a Polaris component for it?
│   ├── Yes → Use Polaris. Pass label / accessibilityLabel / helpText / error props. STOP.
│   └── No → Continue.
│
├── Is there a native HTML element for it (button, a, input, label, table, dialog)?
│   ├── Yes → Use native HTML. Add ARIA only if native semantics insufficient.
│   └── No → Continue.
│
├── Are you building a custom widget (combobox, accordion, tabs)?
│   ├── Yes → Look one more time for a Polaris equivalent. If genuinely none:
│   │        follow WAI-ARIA Authoring Practices pattern exactly,
│   │        write keyboard handlers, test with NVDA + VoiceOver,
│   │        document the ARIA contract in the component header
│   └── No → Reconsider; you probably do not need a new widget
│
After build:
│
├── Run axe-core. Zero critical / serious violations? → Continue. Else fix.
├── Tab through entire flow with no mouse. Reach everything? → Continue. Else fix focus order.
├── Open NVDA + Firefox. Every Button, Field, Heading announced clearly? → Continue. Else add accessibilityLabel / fix heading.
├── Open VoiceOver + Safari. Same pass. → Continue. Else fix.
├── Sample colors with devtools. 4.5:1 text, 3:1 borders? → Continue. Else swap to Polaris token.
└── Resize to 320 px wide and 200% zoom. No clipping? → Ship. Else use Polaris layout primitives (BlockStack, InlineStack, InlineGrid) to fix reflow.
```

## Sources

- [Polaris Accessibility — Shopify Polaris React](https://polaris-react.shopify.com/foundations/accessibility)
- [Accessibility testing — Shopify/polaris (GitHub)](https://github.com/Shopify/polaris/blob/main/documentation/Accessibility%20testing.md)
- [Accessibility best practices for Shopify apps — shopify.dev](https://shopify.dev/docs/apps/build/accessibility)
- [ui-modal — App Bridge Library](https://shopify.dev/docs/api/app-bridge-library/web-components/ui-modal)
- [Polaris Color Tokens](https://polaris-react.shopify.com/tokens/color)
- [Screen Reader Testing Guide — TestParty](https://testparty.ai/blog/screen-reader-testing-guide)
