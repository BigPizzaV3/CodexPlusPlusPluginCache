---
name: ux-modern-app-feel
description: "Use when you want a Shopify embedded app to feel modern, fast, and opinionated like Linear, Notion, Vercel, or Cron — speed-first, keyboard-first, calm UI, opinionated defaults, no-config success path. Covers keyboard shortcuts inside App Bridge, command palette patterns, micro-interactions Polaris allows, density vs spacious tradeoffs, brand expression within Polaris tokens, and 15 concrete patterns to copy from modern SaaS into Polaris-compliant Shopify apps. Triggers: 'modern shopify app', 'fast app', 'linear-style ux', 'notion-style ux', 'keyboard shortcuts shopify app', 'command palette', 'calm ui', 'minimalist polaris', 'opinionated defaults', 'fewer settings', 'speed first'."
---

# Modern App Feel for Shopify Embedded Apps

Most Shopify apps feel like 2015 — wall-of-settings, slow page loads, mouse-only, no keyboard, no taste. The modern reference is Linear, Notion, Vercel, Cron, Raycast, Superhuman, Arc — apps that feel calm, instant, opinionated, and keyboard-first. This skill is how to bring that feel inside Polaris and App Bridge 4.x without breaking the Built for Shopify (BFS) badge or merchant expectations.

The premise: Polaris is the floor, not the ceiling. You can absolutely build a Linear-tier embedded app within Polaris — you just have to be deliberate about the seven things that actually make an app feel modern, and ruthless about everything else.

---

## When to Use This Skill

Use when:
- Building a new Shopify embedded app and you want it to feel categorically better than the competitor apps in the same category
- Refactoring an existing app that feels slow, cluttered, or "Shopify-default" with no taste
- Asked "how do I make this feel more like Linear / Notion / Vercel inside a Shopify app"
- Adding keyboard shortcuts, a command palette, optimistic UI, or other speed-feel patterns to an embedded app
- Deciding between dense vs spacious layouts for a merchant-facing dashboard
- Asked about brand expression — when can you override Polaris colors, and when shouldn't you
- About to ship an "infinite settings" page and want the heuristic for whether each setting earns its place
- Considering a custom design system on top of Polaris (almost always wrong — this skill explains why)

Do NOT use when:
- Building a checkout extension or storefront block — those have their own constraints (Checkout UI Extensions, theme app extensions)
- Building a non-embedded surface (POS, mobile app shell)
- The merchant has explicitly asked for a Shopify-default-looking app for trust reasons (rare, but real for some legal/finance apps)

---

## The Six Modern SaaS UX Principles (And How Each Lands Inside Polaris)

Every modern SaaS app worth copying — Linear, Notion, Vercel, Cron, Raycast, Superhuman, Arc — converges on these six principles. The trick is translating each into something Polaris-compliant.

### 1. Speed Above Everything

Linear's mantra is "fast is a feature." Anything under 100ms feels instant, anything over 300ms feels slow, anything over 1s loses the user. Modern apps engineer the perceived performance budget aggressively — optimistic UI updates, prefetching, route-level caching, skeleton screens that match real layout.

**Inside Polaris:** Polaris doesn't fight you here. It ships fast-rendering primitives. The bottlenecks are usually (a) your Remix loaders waiting on Shopify GraphQL, (b) re-renders from unmemoized state, (c) no optimistic updates on mutations. Polaris does NOT ship a built-in optimistic UI helper — you wire it yourself with Remix `useFetcher` or TanStack Query.

### 2. Density (When the Merchant Is Power)

Linear, Notion, Airtable use **information-dense** layouts. More rows, smaller padding, tighter typography. The merchant who lives in your app 4 hours a day wants more data per pixel, not more whitespace.

**Inside Polaris:** Polaris spacing tokens default to spacious (gap `400` = 24px). For power-user surfaces, drop to `200` or `300`. `IndexTable` is denser than `ResourceList`. Use `Text variant="bodySm"` (13px) for table cells. Polaris allows this — just stay consistent within a surface.

### 3. Keyboard-First

Linear is famous for: `C` to create, `/` to search, `Cmd+K` to command palette, `?` to show all shortcuts. Every action is reachable without the mouse. Superhuman built a $30/month email business on this principle alone.

**Inside Polaris:** Polaris/App Bridge 4.x has no first-class shortcut API. You add shortcuts yourself with `react-hotkeys-hook` or `Mousetrap`, scoped to the embedded iframe. App Bridge does intercept `Cmd+S` for its save bar — respect that. Otherwise the keyboard is yours.

### 4. Opinionated Defaults

Notion ships with sensible defaults for almost everything. The new doc is named, the cover image is reasonable, the database has 3 useful columns. Compare to Jira: 47 fields, none filled in, you do all the work.

**Inside Polaris:** Pre-fill every form field with the best guess. Pick the most common option in dropdowns. Auto-detect the merchant's brand color from theme. Skip the "configure first" step entirely when possible. Polaris `TextField` accepts a `value` — use it.

### 5. No-Config Success Path

Cron, Linear, and Arc all open with you already at first value. No questionnaire. No empty setup wizard. PageFly's "What do you want to build?" picker is the Shopify-specific version of this — no blank canvas, ever.

**Inside Polaris:** Use the App Bridge install handshake to seed everything you need (OAuth grants scopes, you read the shop, you fetch a few products). The first screen is the product working, not a checklist of things to do.

### 6. Calm UI

Vercel and Linear are quiet. Almost monochrome. One accent color. Generous typography hierarchy. No drop shadows on every card. No animated gradients. No 8 different button styles. The visual noise floor is near-zero, so real content stands out.

**Inside Polaris:** Polaris is already calm — that's its strength. The mistake is OVER-decorating to "stand out" — gradient backgrounds, custom icons, full-bleed hero images. Resist. Polaris's restraint is a gift; lean in. Pick one accent (`--p-color-bg-fill-brand`), use it sparingly, and let the content speak.

---

## Speed: The "Feels Instant" Rule

### The Latency Budget

| Latency | User perception |
|---|---|
| 0–100ms | Feels instant (target this) |
| 100–300ms | Feels responsive |
| 300ms–1s | Noticeable delay |
| 1s+ | Lost the user |

Every interaction in your app should land under 100ms perceived latency. Real network latency from Shopify GraphQL is usually 200–800ms — so perceived speed comes from optimistic UI, not faster network.

### Optimistic UI in Remix

```tsx
import { useFetcher } from '@remix-run/react';
import { useState } from 'react';

export function ToggleSwitch({ id, initialEnabled }) {
  const fetcher = useFetcher();
  const [optimistic, setOptimistic] = useState(initialEnabled);

  const enabled = fetcher.formData
    ? fetcher.formData.get('enabled') === 'true'
    : optimistic;

  const handleToggle = () => {
    const next = !enabled;
    setOptimistic(next);
    fetcher.submit(
      { id, enabled: String(next) },
      { method: 'POST', action: '/api/toggle' }
    );
  };

  return <Checkbox checked={enabled} onChange={handleToggle} />;
}
```

The checkbox flips instantly. The network request happens in the background. If it fails, you revert with a toast.

### Prefetch on Intent (Remix)

```tsx
import { Link } from '@remix-run/react';

<Link to="/products/123" prefetch="intent">
  View product
</Link>
```

`prefetch="intent"` triggers the loader on hover/focus — by the time the merchant clicks, the page is already loaded. Use this on every nav link. It costs almost nothing and makes navigation feel teleportational.

### Skeleton Screens That Match Real Layout

Polaris ships `SkeletonBodyText`, `SkeletonDisplayText`, `SkeletonThumbnail`. Use them, but match the real layout dimensions. A skeleton that resizes when content loads is worse than a slightly slow content load — the layout shift is the jarring bit.

```tsx
{isLoading ? (
  <SkeletonBodyText lines={3} />
) : (
  <Text as="p">{data.description}</Text>
)}
```

### What NOT to Optimize

- Don't add loading spinners under 300ms — they make the app feel slower, not faster
- Don't animate everything — every animation over 200ms is friction
- Don't cache aggressively across shops — stale data is worse than slow data in B2B

---

## Keyboard Shortcuts Inside App Bridge

App Bridge 4.x reserves a small set of system shortcuts (Cmd+S for save bar, Escape for modals). Everything else is yours.

### Recommended Library: react-hotkeys-hook

```bash
npm install react-hotkeys-hook
```

```tsx
import { useHotkeys } from 'react-hotkeys-hook';

export function ProductsPage() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setPaletteOpen(true);
  });

  useHotkeys('c', () => {
    navigate('/products/new');
  }, { enableOnFormTags: false });

  useHotkeys('/', (e) => {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  });

  useHotkeys('shift+?', () => {
    setShortcutsHelpOpen(true);
  });

  return <Page>...</Page>;
}
```

`mod+k` translates to Cmd+K on Mac, Ctrl+K on Windows/Linux — never hardcode `meta` or `ctrl`.

### Suggested Shortcut Set (Linear-Style)

| Key | Action |
|---|---|
| `Cmd+K` | Open command palette |
| `/` | Focus search |
| `C` | Create new (primary entity for current page) |
| `G` then `D` | Go to Dashboard |
| `G` then `P` | Go to Products |
| `G` then `O` | Go to Orders |
| `E` | Edit selected row |
| `Shift+?` | Show shortcuts help |
| `Esc` | Close modal/palette |

### Accessibility Considerations

1. **Never bind unmodified letters globally without checking focus.** Use `enableOnFormTags: false` so `C` doesn't fire while the merchant is typing a product name.
2. **Always provide a visible alternative.** Every shortcut must map to a visible button or menu item. A keyboard-only feature is an accessibility failure.
3. **Show the shortcut next to the button.** Use Polaris `KeyboardKey` component or a small `<kbd>` tag: `Save ⌘S`.
4. **Don't override system shortcuts.** Cmd+T, Cmd+W, Cmd+R, Cmd+L belong to the browser. Cmd+S belongs to App Bridge.
5. **Respect `prefers-reduced-motion`.** If the user has reduced motion on, skip the palette open animation.

### The "?" Help Dialog

Modern apps treat `?` as "show all shortcuts." Build a Polaris `Modal` listing every shortcut, grouped by section. Open it on `Shift+?`. Make it the discovery surface for everything keyboard.

```tsx
<Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts">
  <Modal.Section>
    <BlockStack gap="400">
      <Text variant="headingSm">Navigation</Text>
      <InlineStack gap="400">
        <Text>Go to Dashboard</Text>
        <kbd>G</kbd> <kbd>D</kbd>
      </InlineStack>
      ...
    </BlockStack>
  </Modal.Section>
</Modal>
```

---

## Command Palette Inside Polaris

The command palette is the single highest-leverage modern UX pattern. It collapses navigation, search, and actions into one keyboard-driven surface.

### Option A: Polaris Modal + Combobox (Quick, BFS-Safe)

The easiest implementation uses Polaris primitives directly — `Modal` as the container, `Combobox` as the search-with-results.

```tsx
import { Modal, Combobox, Listbox, Icon } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');

  const commands = [
    { id: 'nav-dashboard', label: 'Go to Dashboard', shortcut: 'G D', action: () => navigate('/') },
    { id: 'nav-products', label: 'Go to Products', shortcut: 'G P', action: () => navigate('/products') },
    { id: 'create-product', label: 'Create product', shortcut: 'C', action: () => navigate('/products/new') },
    { id: 'create-discount', label: 'Create discount', action: () => navigate('/discounts/new') },
    { id: 'search-orders', label: 'Search orders', action: () => navigate('/orders?focus=search') },
  ];

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} title="" small>
      <Modal.Section>
        <Combobox
          activator={
            <Combobox.TextField
              prefix={<Icon source={SearchIcon} />}
              onChange={setQuery}
              value={query}
              placeholder="Type a command or search..."
              autoComplete="off"
              autoFocus
            />
          }
        >
          <Listbox onSelect={(id) => {
            const cmd = commands.find(c => c.id === id);
            cmd?.action();
            onClose();
          }}>
            {filtered.map(cmd => (
              <Listbox.Option key={cmd.id} value={cmd.id}>
                {cmd.label}{cmd.shortcut && ` — ${cmd.shortcut}`}
              </Listbox.Option>
            ))}
          </Listbox>
        </Combobox>
      </Modal.Section>
    </Modal>
  );
}
```

This is good. Not as fast as a real command palette (Modal has open animation, Combobox has its own focus model), but it ships in an afternoon and stays inside Polaris.

### Option B: Custom Palette With cmdk (Linear-Tier)

For a Linear/Raycast-feel palette, use [cmdk](https://cmdk.paco.me/) by Paco Coursey — the same library powering Linear, Vercel, and Raycast palettes. Headless, accessible, fuzzy search built in.

```bash
npm install cmdk
```

```tsx
import { Command } from 'cmdk';
import '@shopify/polaris/build/esm/styles.css';

export function FastPalette({ open, onClose }) {
  return (
    <Command.Dialog open={open} onOpenChange={onClose} label="Command palette">
      <Command.Input placeholder="Type a command..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => navigate('/products')}>
            Products
            <kbd>G P</kbd>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Actions">
          <Command.Item onSelect={() => navigate('/products/new')}>
            Create product
            <kbd>C</kbd>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

You must then style cmdk to match Polaris — use Polaris tokens (`var(--p-color-bg-surface)`, `var(--p-color-text)`, `var(--p-border-radius-200)`) for the wrapper, input, items. The result feels like Linear AND looks like Shopify.

### Palette Rules

1. **Open from Cmd+K, close from Esc.** No exceptions.
2. **Fuzzy match, not exact.** "crt prd" should find "Create product." cmdk does this natively.
3. **Group commands by section.** Navigation, Actions, Search results. Linear does this; Notion does this.
4. **Show shortcuts next to each command.** Teaches users the keybinds passively.
5. **Recents first when query is empty.** Surface the 3 most-used commands at the top of an empty palette.
6. **Keep it under 8 visible items.** More is overwhelming.
7. **No animation on open.** Or under 100ms fade-in. Anything slower breaks the speed feel.

---

## Density vs Spacious

A common mistake: assume Polaris's default spacious feel suits every surface. It doesn't. Pick density per surface based on the merchant's relationship with that surface.

### Use Spacious (gap 400+, padding 400+, bodyMd text) When:

- The merchant visits this surface rarely (settings, billing, account)
- This is an onboarding or first-time-use surface
- The merchant is making an irreversible decision (delete, upgrade, archive)
- Mobile-first surface where touch targets need 44px+
- Marketing-feeling surfaces (welcome, what's new)

### Use Dense (gap 200, padding 200, bodySm text, IndexTable not ResourceList) When:

- The merchant lives here daily (dashboard, orders list, products list)
- This is a power-user view with bulk actions
- The user is comparing many rows or columns
- Desktop-only or desktop-primary surface (most embedded admin apps)
- The merchant has expressed they want "more on screen" (common in 1-star reviews)

### Spacious Default — Reference

```tsx
<Page title="Settings">
  <Layout>
    <Layout.Section>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Brand</Text>
            <TextField label="Store name" />
          </BlockStack>
        </Card>
      </BlockStack>
    </Layout.Section>
  </Layout>
</Page>
```

### Dense Power-User — Reference

```tsx
<Page title="Orders" fullWidth>
  <Card padding="200">
    <IndexTable
      condensed
      resourceName={{ singular: 'order', plural: 'orders' }}
      itemCount={orders.length}
      headings={[
        { title: 'Order' },
        { title: 'Date' },
        { title: 'Customer' },
        { title: 'Total' },
        { title: 'Status' },
      ]}
    >
      {orders.map(order => (
        <IndexTable.Row key={order.id} id={order.id}>
          <IndexTable.Cell>
            <Text variant="bodySm" fontWeight="medium">{order.name}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodySm" tone="subdued">{order.date}</Text>
          </IndexTable.Cell>
          ...
        </IndexTable.Row>
      ))}
    </IndexTable>
  </Card>
</Page>
```

`IndexTable` with `condensed` + `padding="200"` + `bodySm` cells gets you ~40% more rows on screen vs default Polaris.

---

## Brand Expression Within Polaris

Polaris allows brand expression in a few sanctioned ways. Use these; don't go further or you risk BFS rejection.

### Sanctioned Customization

1. **Override `--p-color-bg-fill-brand` and friends.** Polaris exposes brand color tokens as CSS variables. Override at the app root.

```css
:root {
  --p-color-bg-fill-brand: #6E56CF;
  --p-color-bg-fill-brand-hover: #7C66D9;
  --p-color-bg-fill-brand-active: #5A45B5;
  --p-color-text-brand-on-bg-fill: #FFFFFF;
}
```

This recolors primary buttons, selected states, and brand accents while leaving everything else Polaris-default. Safe, tasteful, BFS-compliant.

2. **Custom logo / icon in title bar.** Use App Bridge `<ui-title-bar>` slot for a small brand mark next to the page title.

3. **Branded empty states.** Polaris `EmptyState` accepts a custom `image` prop. Use it for a single tasteful illustration per surface.

4. **One accent color, used sparingly.** Pick one accent, apply it to maybe 3 places: primary button, active nav item, brand mark. Don't paint everything.

### Off-Limits Customization (Breaks BFS)

- Replacing Polaris typography with a custom font family
- Changing border radius globally (Polaris has a tight radius system — don't redefine `--p-border-radius-*`)
- Custom Button components that don't match Polaris button anatomy
- Custom Card components with gradients, shadows, or borders not in the Polaris palette
- Dark mode that Polaris hasn't sanctioned
- Custom modal/dialog primitives (use `<ui-modal>` from App Bridge or Polaris `Modal`)
- Replacing IndexTable with a custom table component

### The Rule of Thumb

**Override tokens, not components.** Polaris is fine with you re-coloring a button. Polaris is not fine with you replacing the button. If you find yourself building a "FancyButton" wrapper, you're crossing the line. If you find yourself adding a CSS variable override at the root, you're inside the lines.

---

## Micro-Interactions Polaris Allows

Modern apps feel alive because of small motion details — a hover lift, a focus ring, a check animation. Polaris ships some of these and tolerates others.

### Built Into Polaris

- Button hover (subtle bg color shift, ~150ms)
- Focus ring on Tab navigation (a11y mandatory — never disable)
- Modal fade-in / scale-in
- Toast slide-up
- Loading spinner on Button (when `loading` prop is true)

### Acceptable Custom Micro-Interactions

```css
/* Subtle hover lift on cards in a grid */
.dashboard-card {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.dashboard-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--p-shadow-200);
}

/* Number count-up animation for stats (use Framer Motion or react-spring) */
/* OK if the duration is < 600ms and respects prefers-reduced-motion */

/* Optimistic checkmark fade-in on save success */
.save-checkmark {
  animation: fadeIn 200ms ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
```

### Always Honor `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Anti-Pattern: Animation Overload

Don't animate everything. If three elements animate at once on page load, the app feels noisy, not modern. Linear has near-zero motion. Notion has near-zero motion. Vercel has near-zero motion. Restraint signals taste.

---

## Opinionated Defaults > Infinite Settings

The settings page is where SaaS apps go to die. Every config option is a decision the merchant didn't ask to make. The Linear/Notion answer: ship with the best default, surface a setting only if you can prove it matters.

### Heuristic: Earn the Setting

Before adding a setting, ask:
1. **Does this setting cause a 1-star review when it's wrong?** If no, don't add it.
2. **Will more than 20% of merchants change the default?** If no, don't add it — ship the default and let the rare exceptions email support.
3. **Can you auto-detect the right value?** Auto-detect beats asking. (Brand color from theme, currency from shop, timezone from shop.)
4. **Can you defer the question to when it actually matters?** Don't ask at install — ask at first use.
5. **Could two settings be one?** "Email frequency: daily/weekly" + "Email enabled: yes/no" should collapse to "Email frequency: off/daily/weekly."

### Sensible Default Examples

| Setting | Bad default | Good default |
|---|---|---|
| Email sender | empty, requires merchant input | shop owner's name + shop name |
| Brand color | #000000 | auto-detected from theme primary color |
| Timezone | UTC | shop's configured timezone |
| Currency | USD | shop's configured currency |
| Notification frequency | "Please choose" | "Daily digest" |
| First widget placement | "Choose where" | auto-placed via theme app extension |

### The Settings Page Anatomy

If you must have a settings page:
- Group settings into 3–5 sections max
- Each section ≤ 5 settings
- The most-changed setting at the top of each section
- A "Reset to defaults" button (Polaris `Button variant="tertiary"`)
- A search input if you have > 15 total settings (and if you have > 15, you have too many)

---

## 15 Modern UX Patterns to Copy

Each pattern lists the source app, what it does, and the Polaris/App Bridge implementation.

### 1. Command Palette (Cmd+K)
**Source:** Linear, Vercel, Raycast, Superhuman, Notion
**Pattern:** Cmd+K opens a fuzzy-searchable list of every command and navigation target in the app.
**Polaris implementation:** Polaris `Modal` + `Combobox` for a quick version, or `cmdk` library styled with Polaris tokens for the Linear-tier version. See "Command Palette Inside Polaris" above.

### 2. Optimistic UI on Toggles
**Source:** Linear (issue status), Vercel (deploy toggles), Notion (checkboxes)
**Pattern:** Click flips state instantly, network request runs in background, revert on failure.
**Polaris implementation:** `useFetcher` from Remix + local state. See "Optimistic UI in Remix" above.

### 3. Prefetch on Hover
**Source:** Vercel, Linear, Arc
**Pattern:** Hover a link, the destination preloads, click feels teleportational.
**Polaris implementation:** `<Link prefetch="intent">` from Remix. Apply to every nav item.

### 4. Slash Menu for Inline Actions
**Source:** Notion, Linear (in comments)
**Pattern:** Type `/` in any text field to insert blocks, mentions, or quick actions.
**Polaris implementation:** Polaris `TextField` with a custom listener for `/`, opening a `Popover` with `Listbox` of actions.

### 5. Inline Edit in Tables
**Source:** Airtable, Notion, Linear
**Pattern:** Click a table cell to edit it in place — no modal, no detail page.
**Polaris implementation:** `IndexTable.Cell` with a `TextField` that activates on click, blur saves, Esc cancels.

### 6. Breadcrumb-Driven Hierarchy
**Source:** Notion, Linear (project > issue path)
**Pattern:** Breadcrumb shows nested path, each segment is clickable, last segment is current page.
**Polaris implementation:** Polaris `Page` accepts `backAction` for one-level back; for multi-level, use App Bridge `<ui-title-bar>` with custom breadcrumb in the title slot.

### 7. Quiet Empty States
**Source:** Linear, Cron
**Pattern:** Empty state is a single sentence + one CTA. No illustrations, no marketing copy.
**Polaris implementation:** Polaris `EmptyState` with `image` prop set to a minimal SVG (or none), `heading` one short sentence, `action` one button.

### 8. Persistent Sidebar Search
**Source:** Notion (top of sidebar), Linear (Cmd+/)
**Pattern:** A search input persistently visible in the nav — not buried behind an icon.
**Polaris implementation:** App Bridge `<ui-nav-menu>` doesn't support inline search natively. Add it just below the nav using Polaris `TextField` with `prefix={<Icon source={SearchIcon} />}`.

### 9. Right-Side Detail Panel
**Source:** Linear (click an issue, panel slides in from right), Notion (page peek)
**Pattern:** Click a row, a panel slides in from the right with full detail. No navigation away.
**Polaris implementation:** App Bridge does not ship a slide-over. Build with Polaris `Modal` set to `large` size and right-aligned via custom CSS, OR build a custom drawer with proper focus trap and `aria-modal`.

### 10. Status Badges With Meaning
**Source:** Linear (priority colors), Vercel (deploy status)
**Pattern:** Tiny colored dot + label. Consistent color = consistent meaning across the app.
**Polaris implementation:** Polaris `Badge` with `tone` prop (`success`, `warning`, `critical`, `info`, `attention`). Use the same tone for the same meaning everywhere.

### 11. Keyboard Sequence Shortcuts
**Source:** Linear (`G` then `D` = go to dashboard, Vim-style)
**Pattern:** Two-key sequence shortcuts free up single keys. `G` opens a "go to" prompt; the next key picks the destination.
**Polaris implementation:** `react-hotkeys-hook` supports sequences: `useHotkeys('g>d', ...)`.

### 12. Live-Updating Numbers
**Source:** Linear (issue counts), Vercel (deploy logs)
**Pattern:** Numbers in the UI update in real time as data changes — no refresh button.
**Polaris implementation:** Remix `useRevalidator` + polling, or `useFetcher` with interval, or websockets. Polaris doesn't fight you; the data layer does the work.

### 13. Single Accent Color
**Source:** Vercel (black + one purple), Linear (subtle indigo)
**Pattern:** One accent, used in ≤ 3 places. Everything else is grayscale.
**Polaris implementation:** Override `--p-color-bg-fill-brand` to your accent. Don't recolor anything else.

### 14. Confirm-by-Type for Destructive Actions
**Source:** Vercel, GitHub
**Pattern:** Deleting a project? Type the project name to confirm. No accidental destruction.
**Polaris implementation:** Polaris `Modal` with `TextField` inside, primaryAction `disabled` until the typed value matches.

### 15. Toast Stack With Undo
**Source:** Linear (every action has undo), Notion
**Pattern:** Action succeeds, toast appears with "Undo" button, undo reverses the change for 5 seconds.
**Polaris implementation:** Use App Bridge `shopify.toast()` with a custom action button, OR Polaris `Toast` with an `action` prop pointing to your undo handler.

---

## Anti-Patterns (Things That Break BFS or the Modern Feel)

### 1. Custom Design System on Top of Polaris
You build `MyButton`, `MyCard`, `MyModal`, all wrapping Polaris with "improvements." Six months in, you've drifted from Polaris and the BFS reviewer flags inconsistency with Shopify Admin. **Don't.** Override tokens, not components.

### 2. Replacing Polaris Typography
Custom fonts feel like "branding" but break the calm visual hierarchy Polaris enforces. Polaris uses Shopify's `Inter`-based stack; matching merchant typography expectations across the Admin is part of the BFS criteria.

### 3. Animation Overload
Hero on page load, cards fade in staggered, sidebar slides, button pulses on hover, success checkmark spins. By the time the merchant has seen one screen they're motion-sick. **Pick one or two micro-interactions per surface, max.**

### 4. Dark Mode Without Polaris's Blessing
Polaris dark mode is still partial as of v12. Custom dark mode breaks token contracts. Wait for Polaris to ship full dark mode support.

### 5. Custom Modal/Dialog Primitives
Building a slide-over drawer with your own focus trap, escape handler, and backdrop is harder than it looks. Use App Bridge `<ui-modal>` or Polaris `Modal`. The custom version always misses an a11y case.

### 6. Hiding Pricing Tier Behind a Custom UI
Polaris has `Banner` for upgrade prompts; App Bridge has `<ui-modal>`. Don't build a custom paywall component — it'll feel un-Shopify.

### 7. Infinite Settings
40 settings on a page means you didn't make decisions. The merchant pays for your indecision in cognitive load. Cut.

### 8. Confirmation Modals for Reversible Actions
Linear never asks "Are you sure?" for things you can undo. Modern apps trust users and provide undo. Confirm only for truly destructive actions.

### 9. Loading Spinners Under 300ms
Adding a spinner for a 150ms request makes the request feel slower, not faster. Use optimistic UI or no indicator at all.

### 10. Breaking Cmd+S / Esc / Tab Order
App Bridge owns Cmd+S. Polaris Modal owns Esc. Tab order is governed by DOM order. Don't fight these.

---

## Decision Tree

Use this when deciding whether to add a "modern feel" feature to your app.

```
Question: Should I add this UX pattern to my Shopify app?

├─ Does Polaris ship a primitive for it?
│  ├─ Yes → Use the Polaris primitive. Stop. ✓
│  └─ No → continue
│
├─ Is the pattern a keyboard shortcut?
│  ├─ Yes → Add via react-hotkeys-hook. Ensure visible alternative.
│  │       Add to the "?" help dialog. Stop. ✓
│  └─ No → continue
│
├─ Is the pattern a command palette?
│  ├─ Yes → Start with Polaris Modal + Combobox.
│  │       Upgrade to cmdk only if you need fuzzy/grouped/recents. Stop. ✓
│  └─ No → continue
│
├─ Is the pattern a micro-interaction (hover, focus, transition)?
│  ├─ Yes → ≤ 200ms duration? Respects prefers-reduced-motion?
│  │       ├─ Yes → Ship it. Stop. ✓
│  │       └─ No → Don't ship.
│  └─ No → continue
│
├─ Is the pattern a brand color / accent override?
│  ├─ Yes → Override the relevant --p-color-* token at the root.
│  │       Don't override component-level styles. Stop. ✓
│  └─ No → continue
│
├─ Is the pattern a custom layout / typography / component?
│  ├─ Yes → STOP. You're outside Polaris. BFS risk.
│  │       Re-frame the problem: can you achieve this with Polaris primitives?
│  │       If truly impossible, document why and proceed cautiously.
│  └─ No → continue
│
└─ Is the pattern an opinionated default replacing a setting?
   ├─ Yes → Ship it. The merchant gets less choice, more speed. ✓
   └─ No → re-read this skill. The answer is probably "ship a default."
```

---

## Checklist: Modern Shopify App Feel

Before shipping, verify:

- [ ] App Bridge 4.x web components used for save bar, modal, toast (not custom)
- [ ] Polaris 12.x for all UI primitives (Button, Card, TextField, IndexTable, etc.)
- [ ] Cmd+K opens a command palette
- [ ] `/` focuses the primary search input on every list page
- [ ] `C` creates a new entity on every list page
- [ ] `?` opens a keyboard shortcuts help dialog
- [ ] Every primary action button shows its shortcut next to the label
- [ ] Every nav `<Link>` has `prefetch="intent"`
- [ ] Optimistic UI on every toggle / status change
- [ ] No loading spinners shown for requests under 300ms
- [ ] Skeleton screens match real layout dimensions (no layout shift)
- [ ] Power-user surfaces use IndexTable with `condensed` + `padding="200"`
- [ ] Settings surfaces use spacious defaults (gap 400, bodyMd)
- [ ] Brand accent overrides `--p-color-bg-fill-brand` only
- [ ] No custom font families (use Polaris/Shopify default)
- [ ] All micro-interactions ≤ 200ms and honor `prefers-reduced-motion`
- [ ] Every destructive action is undoable OR uses confirm-by-type
- [ ] Toast with "Undo" appears after every reversible action
- [ ] Settings page has ≤ 3 sections, ≤ 5 settings per section
- [ ] First-run experience has no questionnaire — app works immediately
- [ ] Empty states are one sentence + one CTA, no illustrations beyond a single tasteful SVG
- [ ] One accent color used in ≤ 3 places across the app

If every box is checked, your Shopify app feels like Linear inside Polaris. Which is the goal.
