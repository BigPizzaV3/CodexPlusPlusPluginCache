---
name: ux-polaris-antipatterns
description: "Use when reviewing or writing Polaris UI for common design mistakes — using deprecated Stack instead of BlockStack/InlineStack, modal overuse, blocking validation, wrong tone (success/critical/warning/info), custom CSS overrides instead of tokens, off-brand colors, mis-sized cards, missing helpText, no FormLayout, mobile responsive failures, accessibility failures inside Polaris components, drifting between Polaris versions. Triggers: 'polaris mistake', 'polaris anti-pattern', 'polaris stack deprecated', 'polaris design review', 'shopify ui code review', 'polaris best practice', 'polaris vs custom', 'polaris tokens'."
---

# Polaris UI Anti-Patterns (v12+)

A field guide to the 20 most common ways Shopify app teams break the Polaris contract — and the exact fix for each. Use this when reviewing a PR, writing a new screen, or auditing an app pre-submission for Built for Shopify.

The principle behind every rule: **Shopify admin is a shared design surface.** Merchants have already learned its patterns. The closer your app feels to the rest of admin, the higher your install-to-activation rate. The further you drift, the more your app feels like a third-party graft — and the more support tickets you get from confused merchants.

---

## 1. When to use

Pull this skill in when you are:

- Reviewing a pull request that touches `@shopify/polaris` components
- Writing a new screen and unsure whether a custom component is warranted
- Migrating from Polaris 10 or 11 to 12+
- Preparing an app for App Store submission or Built for Shopify certification
- Debugging "why does our app look off-brand?" complaints
- Diagnosing accessibility audit failures
- Deciding between `<Modal>`, `<Banner>`, `<Toast>`, or inline error
- Choosing between custom CSS and design tokens

If the user mentions Polaris, Stack, BlockStack, design tokens, `--p-color-*`, `className` on Polaris components, Modal overuse, or "this feels off-brand" — trigger this skill.

---

## 2. The 20 anti-patterns, ranked by severity

Ranked by how badly each one degrades the merchant experience (1 = catastrophic, 20 = nit). Fixes are in the "do this instead" column.

| # | Anti-pattern | Severity | Do this instead |
|---|---|---|---|
| 1 | Using `<Stack>` / `<LegacyStack>` / `<VerticalStack>` / `<HorizontalStack>` | Build-breaking on v12+ | `<BlockStack>` (vertical) or `<InlineStack>` (horizontal). Run `npx @shopify/polaris-migrator` |
| 2 | Wrapping Polaris components in custom `className` for styling | High — most Polaris components do not accept `className` | Use the component's built-in props (`tone`, `variant`, `padding`, `gap`). For exceptions, use `<Box>` with token props |
| 3 | Hex codes (`color: #008060`) instead of design tokens | High — instantly off-brand on theme changes | `var(--p-color-bg-fill-success)` or a `tone` prop |
| 4 | Modal for non-blocking errors or confirmations | High — blocks the merchant; high abandonment | `<Banner>` for in-context info, `<Toast>` for transient confirmations, inline error for forms |
| 5 | Toast for errors that need explanation | High — disappears in 3s, easily missed | `<Banner tone="critical">` with title + body + recovery action |
| 6 | Using `tone="success"` for neutral or informational | Medium — semantic noise | `tone="info"` for info, no tone for neutral |
| 7 | Using `tone="critical"` for warnings | Medium — desensitizes the merchant to real errors | `tone="warning"` for cautionary, `tone="critical"` only for destructive/error |
| 8 | Missing `<FormLayout>` around form fields | Medium — inconsistent spacing | Always wrap related fields in `<FormLayout>` inside `<Form>` |
| 9 | Blocking validation on every keystroke | Medium — feels hostile, breaks flow | Validate on blur or on submit; clear errors on next change |
| 10 | Missing `helpText` on non-obvious fields | Medium — drives support tickets | `helpText` describing format, examples, or constraints |
| 11 | Forgetting to import `@shopify/polaris/build/esm/styles.css` | High — entire app looks unstyled | Import once in the app root, before `<AppProvider>` |
| 12 | More than 2 filled/shaped buttons in one Card | Medium — destroys hierarchy | One primary, one secondary, rest as plain or inside `<ActionList>` |
| 13 | `<IndexTable>` on mobile without responsive plan | Medium — horizontal scroll hell on phones | Hide columns or switch to `<ResourceList>` below the mobile breakpoint |
| 14 | Modal sized larger than the mobile viewport | Medium — content clipped on phones | `size="small"` for mobile flows; never assume desktop |
| 15 | Icon-only buttons missing `accessibilityLabel` | Medium — screen readers see nothing | Always pass `accessibilityLabel` to icon-only `<Button>` |
| 16 | Error states relying on color alone | Medium — fails WCAG, fails colorblind users | Pair red border with text error message and icon |
| 17 | Importing old icon names (`DeleteMinor`, `EditMajor`) | Medium — works on v10–11, gone in v12+ | Use new icon names (`DeleteIcon`, `EditIcon`) |
| 18 | Custom focus styles that override Polaris focus rings | Medium — keyboard users get lost | Leave focus rings alone, or use `--p-focused` tokens |
| 19 | Card with no padding wrapper | Low — content touches Card edge | `<Box padding="400">` inside, or use `<Card padding="400">` (v12+) |
| 20 | Mixing `tone="subdued"` with low-contrast text on top | Low — fails AA contrast | Don't stack subdued tones; use one level of de-emphasis |

---

## 3. Layout anti-patterns (deepest dive)

### 3.1. The deprecated Stack family

In Polaris 10 there was `<Stack>` with `vertical` and `distribution` props. Polaris 11 split it into `<VerticalStack>` and `<HorizontalStack>`. Polaris 12 renamed those to `<BlockStack>` and `<InlineStack>` to match CSS logical-property language (block axis = vertical, inline axis = horizontal).

Anything still using the old names is either dead code or a build error on v12.

**Wrong (Polaris 10):**
```tsx
<Stack vertical spacing="loose">
  <TextField label="Name" value={name} onChange={setName} />
  <TextField label="SKU" value={sku} onChange={setSku} />
</Stack>
```

**Wrong (Polaris 11):**
```tsx
<VerticalStack gap="4">
  <TextField label="Name" value={name} onChange={setName} />
</VerticalStack>
```

**Right (Polaris 12+):**
```tsx
<BlockStack gap="400">
  <TextField label="Name" value={name} onChange={setName} />
  <TextField label="SKU" value={sku} onChange={setSku} />
</BlockStack>
```

Note the gap scale also changed: `"loose"` / `"4"` became `"400"` (the numeric token scale). Migrator handles this:

```bash
npx @shopify/polaris-migrator react-rename-component@v12 \
  --renameFrom=VerticalStack --renameTo=BlockStack \
  "src/**/*.tsx"
```

### 3.2. Modal overuse

Shopify's own guidance: modals block the merchant until they make a decision. They are a power move. Reach for them only when:

1. The action is consequential and reversible needs explicit consent (delete, publish, send invoice)
2. You need a focused mini-form that does not fit in the existing page
3. You are showing a confirmation step that genuinely benefits from an interruption

Do **not** use modals for:

- Telling a merchant that something went wrong (use `<Banner>` in-context)
- Confirming a successful save (use `<Toast>`)
- Showing extra information the merchant can read later (use `<Popover>` or expand a section)
- "Are you sure?" on non-destructive actions (just do the action; offer undo via Toast)

### 3.3. Oversized cards

A common mistake: stuffing an entire feature into a single Card with deeply nested sections. This breaks visual hierarchy and forces merchants to scroll past unrelated content.

**Wrong:**
```tsx
<Card>
  <Card.Section title="Basic info">...</Card.Section>
  <Card.Section title="Pricing">...</Card.Section>
  <Card.Section title="Inventory">...</Card.Section>
  <Card.Section title="Shipping">...</Card.Section>
  <Card.Section title="SEO">...</Card.Section>
  <Card.Section title="Advanced">...</Card.Section>
</Card>
```

**Right:**
```tsx
<BlockStack gap="400">
  <Card>
    <BlockStack gap="300">
      <Text variant="headingMd" as="h2">Basic info</Text>
      {/* fields */}
    </BlockStack>
  </Card>
  <Card>
    <BlockStack gap="300">
      <Text variant="headingMd" as="h2">Pricing</Text>
      {/* fields */}
    </BlockStack>
  </Card>
  {/* one Card per logical section */}
</BlockStack>
```

Rule of thumb: a Card is a unit of meaning. If two sections do not belong on the same screen for the same task, they should be separate Cards. If a Card has more than 3 sections, split it.

---

## 4. Form anti-patterns

### 4.1. Wrong field types

Shopify admin merchants type tens of fields per day. Wrong field types cost them speed and trust.

| Wrong | Right | Why |
|---|---|---|
| `<TextField>` for currency without `prefix="$"` and `type="number"` | `<TextField type="currency" prefix="$">` | Mobile keyboard, alignment, parsing |
| `<TextField>` for a fixed choice | `<Select>` or `<ChoiceList>` | Free-text invites errors |
| `<Select>` with 2 options | `<Checkbox>` or `<RadioButton>` | Two-state UI should not require a dropdown |
| `<Checkbox>` for "either A or B" | `<RadioButton>` group | Checkbox implies independent toggles |
| Inline `<input>` mixed with Polaris fields | `<TextField>` | Inconsistent focus rings, sizing, error states |

### 4.2. Blocking validation

**Wrong (validates on every keystroke):**
```tsx
const handleChange = (value: string) => {
  setName(value);
  if (value.length < 3) {
    setNameError("Must be at least 3 characters");
  }
};
```

The merchant types "Ab" and immediately sees an error before they can type the third letter. This is hostile.

**Right (validates on blur, clears on change):**
```tsx
const handleChange = (value: string) => {
  setName(value);
  if (nameError) setNameError(""); // clear on next change
};

const handleBlur = () => {
  if (name.length > 0 && name.length < 3) {
    setNameError("Must be at least 3 characters");
  }
};

<TextField
  label="Name"
  value={name}
  onChange={handleChange}
  onBlur={handleBlur}
  error={nameError}
/>
```

For form-level validation (required fields, cross-field rules) — validate on submit, surface all errors via `<Banner tone="critical">` at the top of the form **plus** inline `error` props on each field.

### 4.3. Missing FormLayout

`<FormLayout>` enforces the correct vertical rhythm and field grouping. Without it, fields touch each other or float with wrong spacing.

**Wrong:**
```tsx
<Form onSubmit={handleSubmit}>
  <TextField label="Name" value={name} onChange={setName} />
  <TextField label="Email" value={email} onChange={setEmail} />
  <Button submit>Save</Button>
</Form>
```

**Right:**
```tsx
<Form onSubmit={handleSubmit}>
  <FormLayout>
    <TextField label="Name" value={name} onChange={setName} />
    <TextField label="Email" value={email} onChange={setEmail} />
  </FormLayout>
  <Button submit>Save</Button>
</Form>
```

Also use `<FormLayout.Group>` to put related short fields on the same row (first name + last name, city + zip).

---

## 5. Color and tone anti-patterns

Polaris uses semantic `tone` props rather than direct colors. Four tones cover almost everything:

| Tone | Meaning | Use for |
|---|---|---|
| `success` | Positive completion | Order shipped, settings saved, payment received |
| `critical` | Destructive or error | Delete, payment failed, validation error |
| `warning` | Cautionary, reversible | Low stock, plan limit, draft will be lost |
| `info` | Neutral information | New feature notice, helpful tip, ongoing sync |

Plus tone modifiers on text: `tone="subdued"` for de-emphasized copy.

**Common misuses:**

```tsx
// WRONG — success tone for a neutral confirmation
<Banner tone="success">Your settings are saved automatically.</Banner>

// RIGHT
<Banner tone="info">Your settings are saved automatically.</Banner>
```

```tsx
// WRONG — critical for a warning
<Banner tone="critical">You have 3 days left in your trial.</Banner>

// RIGHT
<Banner tone="warning">You have 3 days left in your trial.</Banner>
```

```tsx
// WRONG — no tone, custom red color
<Banner style={{ borderColor: "red" }}>Action required</Banner>

// RIGHT
<Banner tone="warning" title="Action required">...</Banner>
```

Rule: if you reach for a hex code in a Polaris context, you are probably picking the wrong tone instead.

---

## 6. Custom CSS overrides — when prohibited

Polaris components are designed as a closed contract. Most do **not** accept a `className` prop. Even when you can shim CSS in via wrappers, doing so is an anti-pattern.

**Hard no:**
- Overriding internal selectors via `.Polaris-Button { ... }` in global CSS
- Wrapping in a `<div className="my-custom-styles">` and targeting child Polaris classes
- Using `!important` to win against Polaris styles
- Patching at runtime via `style={{ }}` on Polaris components that do not document a `style` prop

**Acceptable:**
- Using `<Box>` with token props (`padding`, `background`, `borderRadius`, `borderColor`) to wrap Polaris content
- Adding custom CSS to your own non-Polaris components, using `var(--p-*)` tokens
- Using documented props (`tone`, `variant`, `size`, `gap`)
- Wrapping the entire app shell in a layout div with custom CSS (outermost only)

**The decision rule:** if you want to change how a Polaris component looks, your three options are:

1. Use a documented prop (`tone`, `variant`, `size`).
2. Wrap with `<Box>` and adjust spacing/background.
3. Build a custom component using `<Box>` + Polaris tokens and stop using the Polaris component for that case.

There is no fourth option. Reaching past the contract via CSS will break on every Polaris minor release.

---

## 7. Off-brand styles — use design tokens

Polaris exposes its design tokens as CSS custom properties prefixed `--p-`. They are the single source of truth for color, spacing, radius, shadow, type, motion.

### 7.1. Most-used token families

| Family | Examples |
|---|---|
| Color — surface | `--p-color-bg-surface`, `--p-color-bg-surface-secondary`, `--p-color-bg-surface-hover` |
| Color — fill | `--p-color-bg-fill`, `--p-color-bg-fill-success`, `--p-color-bg-fill-warning`, `--p-color-bg-fill-critical` |
| Color — text | `--p-color-text`, `--p-color-text-subdued`, `--p-color-text-success`, `--p-color-text-critical` |
| Color — border | `--p-color-border`, `--p-color-border-subdued`, `--p-color-border-focused` |
| Spacing | `--p-space-100` (4px), `--p-space-200` (8px), `--p-space-300` (12px), `--p-space-400` (16px), `--p-space-500` (20px), `--p-space-600` (24px), `--p-space-800` (32px) |
| Border radius | `--p-border-radius-100`, `--p-border-radius-200`, `--p-border-radius-300` |
| Shadow | `--p-shadow-100`, `--p-shadow-200`, `--p-shadow-300` |
| Typography | `--p-font-size-300`, `--p-font-weight-medium`, `--p-font-line-height-500` |

### 7.2. Off-brand examples

```css
/* WRONG — hardcoded brand color, breaks if Shopify rebrands or merchant theme changes */
.my-success-pill {
  background: #008060;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
}

/* RIGHT — uses Polaris tokens, follows admin theme automatically */
.my-success-pill {
  background: var(--p-color-bg-fill-success);
  color: var(--p-color-text-on-color);
  padding: var(--p-space-200) var(--p-space-300);
  border-radius: var(--p-border-radius-200);
}
```

**Even better:** don't write the CSS at all. Use `<Badge tone="success">Active</Badge>`.

Always prefer **semantic** tokens (`--p-color-bg-fill-success`) over **primitive** tokens (`--p-color-green-500`). Primitive tokens may shift; semantic tokens hold their meaning across themes and versions.

---

## 8. Mobile responsive failures

Shopify admin is used on mobile by ~40% of merchants on certain workflows (order check, inventory tweak, support reply). Embedded apps that assume desktop fail in production.

### 8.1. IndexTable on narrow viewports

`<IndexTable>` is wide by default. On a 375px viewport, anything past 3 columns scrolls horizontally inside an iframe — confusing and easy to miss.

**Fixes, ranked:**

1. **Hide columns below a breakpoint.** Polaris does not have a built-in `hideOnMobile`; use a conditional render based on viewport width.
   ```tsx
   const isMobile = useMediaQuery("(max-width: 768px)");

   const headings = isMobile
     ? [{ title: "Name" }, { title: "Status" }]
     : [
         { title: "Name" },
         { title: "SKU" },
         { title: "Inventory" },
         { title: "Status" },
         { title: "Last updated" },
       ];
   ```
2. **Switch to `<ResourceList>` for mobile.** Lists stack naturally; tables do not.
3. **Pin the most important column.** Polaris IndexTable supports sticky columns since v12.

### 8.2. Modal sizing

```tsx
// WRONG — assumes desktop; clips on phones
<Modal open={open} onClose={close} title="Edit" size="large">

// RIGHT — small modal on mobile, large on desktop
<Modal
  open={open}
  onClose={close}
  title="Edit"
  size={isMobile ? "small" : "large"}
>
```

### 8.3. Card padding on small screens

Generous desktop padding (e.g., `padding="500"`) eats the small screen. Use responsive padding:

```tsx
<Card padding={{ xs: "300", md: "500" }}>
  ...
</Card>
```

### 8.4. Layout sections

Two-column layouts must collapse to one column under ~768px. `<Layout>` and `<InlineGrid>` handle this automatically only if you use the responsive `columns` prop:

```tsx
// WRONG — always two columns, broken on mobile
<InlineGrid columns="1fr 1fr" gap="400">

// RIGHT — collapses to one column on mobile
<InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
```

---

## 9. Accessibility failures inside Polaris

Polaris is WCAG 2.1 AA compliant out of the box. App teams break that compliance with custom code around Polaris.

### 9.1. Missing labels

```tsx
// WRONG — no label, no accessibility label
<TextField placeholder="Search..." value={query} onChange={setQuery} />

// RIGHT
<TextField
  label="Search products"
  labelHidden
  placeholder="Search..."
  value={query}
  onChange={setQuery}
/>
```

`labelHidden` keeps the visual layout clean while still providing an accessible label to screen readers.

### 9.2. Icon-only buttons

```tsx
// WRONG — screen reader hears "Button"
<Button icon={DeleteIcon} onClick={handleDelete} />

// RIGHT
<Button
  icon={DeleteIcon}
  accessibilityLabel="Delete product"
  onClick={handleDelete}
/>
```

### 9.3. Focus order

When you build a modal or popover, the first focusable element should be the most likely action. Polaris handles this for `<Modal>` (first input or primary action gets focus). But if you build a custom flow:

- First focusable on open = main task action or first input
- Tab should move forward through fields in reading order
- Escape closes the modal
- Focus returns to the trigger element on close

If you implement a custom dropdown or popover, replicate this. Better: just use `<Popover>` and `<ActionList>`.

### 9.4. Contrast

Polaris tokens are designed to pass AA. Two common ways teams break contrast:

1. **Stacking subdued tones.** `<Text tone="subdued">` on `<Box background="bg-surface-secondary">` can drop below 4.5:1.
2. **Custom colors over branded backgrounds.** If you change a Card background via `<Box background="...">`, re-test all text inside it.

Run an Axe audit before submission. The most common embedded-app failures are: missing form labels, icon-only buttons without aria-label, and color-only error indication.

---

## 10. Migration drift — Polaris 10 → 11 → 12+

If your codebase has been around for more than 18 months, you have drift. Symptoms: components that worked have started warning, build size grew, some screens use new patterns and some use old.

### 10.1. Component renames (10 → 11 → 12)

| Polaris 10 | Polaris 11 | Polaris 12+ |
|---|---|---|
| `<Stack vertical>` | `<VerticalStack>` | `<BlockStack>` |
| `<Stack>` (horizontal) | `<HorizontalStack>` | `<InlineStack>` |
| `<Stack.Item>` | (n/a — children are direct) | (n/a) |
| `<TextStyle variation="strong">` | `<Text fontWeight="semibold">` | `<Text fontWeight="semibold">` |
| `<DisplayText>` | `<Text variant="headingXl">` | `<Text variant="headingXl">` |
| `<Heading>` | `<Text variant="headingMd">` | `<Text variant="headingMd">` |
| `<Subheading>` | `<Text variant="headingSm">` | `<Text variant="headingSm">` |
| `<Caption>` | `<Text variant="bodySm">` | `<Text variant="bodySm">` |
| `<Visually Hidden>` | `<VisuallyHidden>` | (use `labelHidden` or `Text visuallyHidden`) |
| `<Card sectioned>` | `<Card><Card.Section>` | `<Card padding="400">` |
| `<Stack spacing="loose">` | `gap="4"` | `gap="400"` |

### 10.2. Icon renames

Old: `DeleteMinor`, `EditMajor`, `SaveMinor`, `SearchMinor`, `CancelMinor`, `PlusMinor`, `MinusMinor`, `RefreshMinor`, `ChevronDownMinor`.

New (v12+): `DeleteIcon`, `EditIcon`, `SaveIcon`, `SearchIcon`, `XIcon`, `PlusIcon`, `MinusIcon`, `RefreshIcon`, `ChevronDownIcon`.

The "Minor / Major" suffix is gone. Always `*Icon`.

```tsx
// WRONG (Polaris 10–11)
import { DeleteMinor, EditMajor } from "@shopify/polaris-icons";

// RIGHT (Polaris 12+)
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";
```

### 10.3. Use the migrator

```bash
# Install once
npm install --save-dev @shopify/polaris-migrator

# Run all v11 → v12 migrations
npx @shopify/polaris-migrator migrate v11-react-rename-components "src/**/*.tsx"
npx @shopify/polaris-migrator migrate v12-react-replace-icons "src/**/*.tsx"
npx @shopify/polaris-migrator migrate v12-react-update-spacing-tokens "src/**/*.tsx"
```

After running, do a manual audit of:
- `<Card>` instances (sectioned → padding)
- Custom CSS using old spacing names
- Storybook stories
- Snapshot tests

---

## 11. Anti-pattern → fix table with before/after code

### 11.1. Deprecated Stack

```tsx
// BEFORE
<Stack vertical spacing="tight">
  <Stack.Item><TextField label="Name" /></Stack.Item>
  <Stack.Item><TextField label="SKU" /></Stack.Item>
</Stack>

// AFTER
<BlockStack gap="200">
  <TextField label="Name" />
  <TextField label="SKU" />
</BlockStack>
```

### 11.2. Modal overuse for confirmation

```tsx
// BEFORE — interrupts the merchant
<Modal
  open={savedOpen}
  onClose={() => setSavedOpen(false)}
  title="Saved!"
  primaryAction={{ content: "OK", onAction: () => setSavedOpen(false) }}
>
  <Modal.Section>Your changes are saved.</Modal.Section>
</Modal>

// AFTER — Toast for transient success
shopify.toast.show("Changes saved", { duration: 3000 });
// or in React:
<Toast content="Changes saved" onDismiss={dismiss} />
```

### 11.3. Toast for an error that needs detail

```tsx
// BEFORE — disappears in 3s, no recovery path
<Toast content="Failed" error onDismiss={dismiss} />

// AFTER — Banner with title, body, and recovery action
<Banner
  tone="critical"
  title="Could not save product"
  action={{ content: "Retry", onAction: handleRetry }}
>
  <p>The inventory API timed out. Your changes are not saved.</p>
</Banner>
```

### 11.4. Wrong tone

```tsx
// BEFORE
<Banner tone="success">You have 3 days left in your trial.</Banner>

// AFTER
<Banner tone="warning" title="Trial ending soon">
  You have 3 days left in your trial.
</Banner>
```

### 11.5. Hex colors

```tsx
// BEFORE
<div style={{ backgroundColor: "#d3f9d8", padding: "12px" }}>
  Connected
</div>

// AFTER (option A — use the component)
<Badge tone="success">Connected</Badge>

// AFTER (option B — use Box with tokens)
<Box background="bg-fill-success" padding="300">
  <Text tone="success">Connected</Text>
</Box>
```

### 11.6. className override

```tsx
// BEFORE — does nothing on most Polaris components; relies on fragile selectors
<Button className="my-custom-button">Save</Button>
// in CSS:
.my-custom-button { background: orange !important; }

// AFTER — use documented props
<Button variant="primary" tone="success">Save</Button>
```

### 11.7. No FormLayout

```tsx
// BEFORE
<Form onSubmit={submit}>
  <TextField label="Name" value={name} onChange={setName} />
  <TextField label="Email" value={email} onChange={setEmail} />
  <Checkbox label="Subscribe" checked={sub} onChange={setSub} />
  <Button submit>Save</Button>
</Form>

// AFTER
<Form onSubmit={submit}>
  <FormLayout>
    <TextField label="Name" value={name} onChange={setName} />
    <TextField label="Email" value={email} onChange={setEmail} />
    <Checkbox label="Subscribe" checked={sub} onChange={setSub} />
  </FormLayout>
  <Box paddingBlockStart="400">
    <Button submit variant="primary">Save</Button>
  </Box>
</Form>
```

### 11.8. Blocking keystroke validation

```tsx
// BEFORE
<TextField
  label="Name"
  value={name}
  onChange={(v) => {
    setName(v);
    setError(v.length < 3 ? "Too short" : "");
  }}
  error={error}
/>

// AFTER
<TextField
  label="Name"
  value={name}
  onChange={(v) => { setName(v); if (error) setError(""); }}
  onBlur={() => {
    if (name.length > 0 && name.length < 3) setError("Must be at least 3 characters");
  }}
  error={error}
  helpText="At least 3 characters"
/>
```

### 11.9. Old icon names

```tsx
// BEFORE
import { DeleteMinor, EditMajor, SaveMinor } from "@shopify/polaris-icons";

// AFTER
import { DeleteIcon, EditIcon, SaveIcon } from "@shopify/polaris-icons";
```

### 11.10. IndexTable on mobile

```tsx
// BEFORE — 6 columns, horizontal scroll on mobile
<IndexTable
  headings={[
    { title: "Name" }, { title: "SKU" }, { title: "Vendor" },
    { title: "Inventory" }, { title: "Price" }, { title: "Status" }
  ]}
  ...
/>

// AFTER — collapse to 2 columns under md
const isMobile = useBreakpoints().smDown;
<IndexTable
  headings={
    isMobile
      ? [{ title: "Name" }, { title: "Status" }]
      : [
          { title: "Name" }, { title: "SKU" }, { title: "Vendor" },
          { title: "Inventory" }, { title: "Price" }, { title: "Status" }
        ]
  }
  ...
/>
```

---

## 12. Decision tree

Use this when in doubt about which component to pick.

**Need to tell the merchant something happened.**

- Was the merchant's action successful, and they do not need to think about it further? → `<Toast>`
- Did something fail or need attention that the merchant should see, in context, but can still keep working? → `<Banner>` (use the right tone)
- Does the merchant need to confirm or make a decision before continuing? → `<Modal>`
- Is it a form field problem? → inline `error` prop on the field + `<Banner tone="critical">` summary at top of form

**Need to lay something out.**

- Vertical stack of items? → `<BlockStack gap="...">`
- Horizontal row of items? → `<InlineStack gap="...">`
- Grid of items, responsive? → `<InlineGrid columns="..." gap="...">`
- Wrapper with padding / background / border? → `<Box ...>`
- A full page section with title and actions? → `<Card>` containing `<BlockStack>` containing `<Text variant="headingMd">` + body

**Need to show data.**

- Tabular, with sorting / selection / bulk actions? → `<IndexTable>`
- Browseable list with custom item rendering? → `<ResourceList>`
- Static key-value pairs? → `<DescriptionList>` or `<BlockStack>` with labeled rows

**Need to collect input.**

- Single line of text? → `<TextField>`
- Multi-line text? → `<TextField multiline={4}>`
- Pick one of many? → `<Select>` (5+ options) or `<ChoiceList>` (2–4 options, visible)
- Toggle on/off? → `<Checkbox>` (independent) or `<RadioButton>` (mutually exclusive)
- Date? → `<DatePicker>`
- Wrap fields with consistent spacing? → `<FormLayout>` inside `<Form>`

**Need to style something custom.**

- Can I do it with a Polaris prop? → use the prop
- Can I do it with `<Box>` and tokens? → use `<Box>`
- Neither? → build a custom component using `var(--p-*)` tokens; do not override Polaris CSS

---

## 13. Code review checklist (20 items)

Walk through this list on every PR that touches a Polaris file. Each item maps to one of the anti-patterns above.

- [ ] **1. No deprecated Stack.** No imports of `Stack`, `LegacyStack`, `VerticalStack`, `HorizontalStack`. Only `BlockStack` and `InlineStack`.
- [ ] **2. No className on Polaris components.** Custom styling uses `<Box>` + token props, not class overrides.
- [ ] **3. No hex codes.** All colors come from `var(--p-color-*)` tokens or `tone` props.
- [ ] **4. Modals only for blocking decisions.** No modals for success confirmations or non-blocking errors.
- [ ] **5. Toasts only for transient success.** No toasts for errors that need explanation or recovery.
- [ ] **6. Tone semantics are correct.** Success = positive, critical = destructive/error, warning = cautionary, info = neutral.
- [ ] **7. Forms use `<FormLayout>`.** Fields inside `<Form>` are wrapped in `<FormLayout>` for consistent spacing.
- [ ] **8. Validation is not on keystroke.** Errors appear on blur or submit, not as the merchant is typing.
- [ ] **9. `helpText` exists for non-obvious fields.** Format, examples, or constraints are explained inline.
- [ ] **10. Polaris CSS is imported at app root.** `import "@shopify/polaris/build/esm/styles.css"` runs before `<AppProvider>`.
- [ ] **11. Max 2 filled buttons per Card.** Extras move to `<ActionList>` or plain buttons.
- [ ] **12. IndexTable hides columns on mobile.** Column set changes via `useBreakpoints` or media query.
- [ ] **13. Modal `size` is responsive.** Small on mobile, medium/large on desktop.
- [ ] **14. Icon-only buttons have `accessibilityLabel`.** No bare `<Button icon={...} />` without a label.
- [ ] **15. Errors do not rely on color alone.** Red border + text message + (optional) icon.
- [ ] **16. Icon names are the new style.** `DeleteIcon` not `DeleteMinor`. No `*Minor` or `*Major` suffix.
- [ ] **17. No overrides of Polaris focus rings.** Focus styling is left alone or uses `--p-focused` tokens.
- [ ] **18. Cards have padding.** Either `<Card padding="400">` (v12+) or wrapped in `<Box padding="400">`.
- [ ] **19. Subdued tones are not stacked.** `tone="subdued"` text is not on subdued surface without contrast check.
- [ ] **20. AppProvider wraps the tree.** Exactly one `<AppProvider i18n={...}>` at the root.

---

## Quick reference — token cheat sheet

```css
/* Spacing — use on padding, gap, margin */
--p-space-100   /* 4px  */
--p-space-200   /* 8px  */
--p-space-300   /* 12px */
--p-space-400   /* 16px */
--p-space-500   /* 20px */
--p-space-600   /* 24px */
--p-space-800   /* 32px */

/* Color — semantic */
--p-color-bg-surface
--p-color-bg-surface-secondary
--p-color-bg-fill-success
--p-color-bg-fill-warning
--p-color-bg-fill-critical
--p-color-text
--p-color-text-subdued
--p-color-text-success
--p-color-text-critical
--p-color-border
--p-color-border-focused

/* Radius */
--p-border-radius-100  /* 4px  */
--p-border-radius-200  /* 8px  */
--p-border-radius-300  /* 12px */

/* Shadow */
--p-shadow-100
--p-shadow-200
--p-shadow-300

/* Typography */
--p-font-size-300
--p-font-weight-medium
--p-font-line-height-500
```

When in doubt: use the component prop. When no prop fits: use `<Box>` with token props. When `<Box>` does not fit: write CSS using `var(--p-*)` tokens. Never reach past these three layers.

---

## Sources

- [Migrating from v11 to v12 — Shopify Polaris React](https://polaris-react.shopify.com/version-guides/migrating-from-v11-to-v12)
- [Block stack — Shopify Polaris React](https://polaris-react.shopify.com/components/layout-and-structure/block-stack)
- [Inline stack — Shopify Polaris React](https://polaris-react.shopify.com/components/layout-and-structure/inline-stack)
- [Legacy stack — Shopify Polaris React](https://polaris-react.shopify.com/components/deprecated/legacy-stack)
- [Error messages — Shopify Polaris](https://legacy.polaris.shopify.com/patterns/error-messages)
- [Common actions — Shopify Polaris](https://polaris.shopify.com/patterns/common-actions/best-practices)
- [Tokens — Shopify Polaris React](https://polaris-react.shopify.com/design/layout/layout-tokens)
- [Color tokens — Shopify Polaris React](https://polaris-react.shopify.com/design/colors/color-tokens)
- [polaris-tokens — GitHub](https://github.com/Shopify/polaris-tokens)
- [Shopify Polaris App Design: Build Review-Ready Apps — grumspot](https://grumspot.com/blog/shopify-polaris-app-design)
