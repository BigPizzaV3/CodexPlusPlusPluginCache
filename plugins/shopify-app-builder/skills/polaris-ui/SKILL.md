---
name: polaris-ui
description: "Use this skill for Polaris 12.x UI Components. Triggers include: 'polaris components', 'react ui shopify', 'approvider initialization', 'polaris form', 'polaris button', 'polaris card', 'polaris table indexTable', 'polaris modal dialog', 'polaris select dropdown', 'polaris textfield input', 'polaris checkbox radio', 'polaris navigation', 'polaris layout blocklist inlinestack', 'polaris design tokens', 'polaris icons', 'polaris stack grid', 'polaris page frame resource list', 'polaris loading spinner', 'polaris toast notification', 'polaris banner alert', 'shopify ui component library', 'polaris 12', 'polaris css import', 'polaris styled components', 'polaris form validation', 'polaris accessibility a11y', 'polaris icon reference', 'polaris theme provider', 'polaris page actions buttons'."
---

# Polaris 12.x UI Components

Polaris 12.x is Shopify's official React component library for building consistent, accessible admin and embedded app UIs. This skill covers Polaris component patterns, AppProvider initialization, 25+ commonly-used components, design tokens, form validation, and real-world layout patterns for Shopify apps.

## When Asked

**When asked to build a Shopify app UI with forms and inputs:**
Provide a complete React component example using AppProvider, TextField, Select, Checkbox, and Button components with proper state management and form submission handlers.

**When asked about Polaris layout and spacing:**
Explain BlockStack, InlineStack, and InlineGrid with code examples showing proper spacing, padding, and responsive behavior using gap and padding props.

**When asked to create data tables or resource lists:**
Use IndexTable for tabular data with sorting, selection, and bulk actions; ResourceList for browseable item collections with filters and search.

**When asked about Polaris design tokens or theming:**
Provide color, typography, and spacing token values; explain how to access tokens via CSS variables and customize with custom properties.

**When asked to implement forms with validation:**
Build controlled forms with TextField, Select, Checkbox components; add error states, help text, and form submission with validation logic.

**When asked about Polaris icons and iconography:**
Reference available icons (Icon component, 150+ icons from @shopify/polaris-icons), show Icon usage with color and size props.

**When asked to create modals, dialogs, or overlays:**
Use Modal component for full-screen overlays, Popover for inline popups, and ContextualSaveBar for unsaved changes UI patterns.

---

## Polaris 12.x Architecture Overview

Polaris provides:
- **AppProvider**: Required root component that initializes Polaris context (i18n, theme, CSRF token)
- **25+ UI Components**: Button, Card, Layout (BlockStack, InlineStack, InlineGrid), TextField, Select, Modal, IndexTable, ResourceList, etc.
- **Design Tokens**: Color (primary, success, warning, critical), typography (display, heading, body), spacing (0.5rem, 1rem, 1.5rem, 2rem), shadow, border-radius
- **Polaris Icons**: 150+ SVG icons via @shopify/polaris-icons; Icon component wrapper
- **Accessibility**: WCAG 2.1 AA compliant, semantic HTML, ARIA labels, keyboard navigation
- **CSS Imports**: Import from @shopify/polaris (includes Tailwind-like utility classes; use CSS modules or styled-components for scoping)

### Installation & Setup

```bash
npm install @shopify/polaris @shopify/polaris-icons
# or yarn / pnpm
```

### AppProvider Initialization (Required)

```tsx
import React from 'react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

function App() {
  return (
    <AppProvider i18n={{}}>
      <YourComponent />
    </AppProvider>
  );
}

export default App;
```

**Props:**
- `i18n`: Object with translation strings (optional; defaults to English)
- `features`: Object to enable experimental features
- `colorScheme`: Light (default) or dark mode
- `link`: Function for custom link navigation

---

## Core Layout Components

### BlockStack (Vertical Stack)

```tsx
import { BlockStack, Text } from '@shopify/polaris';

export function VerticalLayout() {
  return (
    <BlockStack gap="400">
      <Text as="h1">Title</Text>
      <Text as="p">Content item 1</Text>
      <Text as="p">Content item 2</Text>
    </BlockStack>
  );
}
```

**Props:**
- `gap`: "100" | "200" | "300" | "400" | "500" (controls vertical spacing; default "200")
- `align`: "start" | "center" | "end"
- `inlineAlign`: "start" | "center" | "end"
- `children`: React elements

### InlineStack (Horizontal Stack)

```tsx
import { InlineStack, Button } from '@shopify/polaris';

export function HorizontalLayout() {
  return (
    <InlineStack gap="400" wrap={false}>
      <Button>Save</Button>
      <Button>Cancel</Button>
    </InlineStack>
  );
}
```

**Props:**
- `gap`: "100" | "200" | "300" | "400" | "500"
- `align`: "start" | "center" | "end" | "space-between" | "space-around"
- `wrap`: boolean (default true)
- `blockAlign`: "start" | "center" | "end" | "baseline"

### InlineGrid (Responsive Grid)

```tsx
import { InlineGrid, Card } from '@shopify/polaris';

export function ResponsiveGrid() {
  return (
    <InlineGrid columns={['oneThird', 'twoThirds']} gap="400">
      <Card title="Sidebar">Filters</Card>
      <Card title="Main">Content</Card>
    </InlineGrid>
  );
}
```

**Props:**
- `columns`: string[] (e.g., ["oneHalf", "oneHalf"], ["oneThird", "twoThirds"], ["full"]; responsive)
- `gap`: "100" | "200" | "300" | "400" | "500"

### Box (Generic Container)

```tsx
import { Box } from '@shopify/polaris';

export function PaddedBox() {
  return (
    <Box padding="400" background="bg-surface-secondary">
      Content with padding
    </Box>
  );
}
```

**Props:**
- `padding`: "0" | "100" | "200" | "300" | "400" | "500"
- `paddingBlock`: vertical padding
- `paddingInline`: horizontal padding
- `background`: "bg-surface" | "bg-surface-secondary" | "bg-fill" | "bg-fill-selected"
- `border`: "divider"
- `borderRadius`: "base" | "large"

---

## Form Components

### TextField (Text Input)

```tsx
import { TextField } from '@shopify/polaris';
import { useState } from 'react';

export function FormInput() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleChange = (value) => {
    setValue(value);
    if (value.length < 3) {
      setError('Minimum 3 characters');
    } else {
      setError('');
    }
  };

  return (
    <TextField
      label="Product Name"
      value={value}
      onChange={handleChange}
      error={error}
      helpText="Enter the product name (3+ chars)"
      placeholder="e.g., Awesome Widget"
      requiredIndicator
    />
  );
}
```

**Props:**
- `label`: string
- `value`: string (controlled component)
- `onChange`: (value: string) => void
- `error`: string | true (displays error message or red border)
- `helpText`: string (gray text below input)
- `placeholder`: string
- `type`: "text" | "email" | "password" | "tel" | "url" | "number" (default "text")
- `disabled`: boolean
- `readOnly`: boolean
- `requiredIndicator`: boolean
- `maxLength`: number
- `prefix`: ReactNode (text/icon before input)
- `suffix`: ReactNode (text/icon after input)

### Select (Dropdown)

```tsx
import { Select } from '@shopify/polaris';
import { useState } from 'react';

export function DropdownSelect() {
  const [selected, setSelected] = useState('option1');

  return (
    <Select
      label="Status"
      options={[
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Archived', value: 'archived' },
      ]}
      value={selected}
      onChange={setSelected}
    />
  );
}
```

**Props:**
- `label`: string
- `options`: { label: string; value: string }[]
- `value`: string (controlled)
- `onChange`: (value: string) => void
- `disabled`: boolean
- `placeholder`: string

### Checkbox & RadioButton

```tsx
import { Checkbox, RadioButton, BlockStack } from '@shopify/polaris';
import { useState } from 'react';

export function CheckboxExample() {
  const [checked, setChecked] = useState(false);

  return (
    <BlockStack gap="200">
      <Checkbox
        label="I agree to terms"
        checked={checked}
        onChange={() => setChecked(!checked)}
        helpText="Read our terms before enabling"
      />
    </BlockStack>
  );
}
```

**Props:**
- `label`: string
- `checked`: boolean
- `onChange`: (checked: boolean) => void
- `disabled`: boolean
- `error`: boolean | string

### Form Component (Wrapper)

```tsx
import { Form, FormLayout, TextField, Select, Button } from '@shopify/polaris';
import { useState } from 'react';

export function AppForm() {
  const [formData, setFormData] = useState({ name: '', category: '' });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      setErrors({ name: 'Required' });
      return;
    }
    console.log('Submit:', formData);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <FormLayout>
        <TextField
          label="Product Name"
          value={formData.name}
          onChange={(value) => setFormData({ ...formData, name: value })}
          error={errors.name}
          requiredIndicator
        />
        <Select
          label="Category"
          options={[
            { label: 'Electronics', value: 'electronics' },
            { label: 'Clothing', value: 'clothing' },
          ]}
          value={formData.category}
          onChange={(value) => setFormData({ ...formData, category: value })}
        />
        <Button submit>Save Product</Button>
      </FormLayout>
    </Form>
  );
}
```

---

## Data Display Components

### Card

```tsx
import { Card, Text, BlockStack } from '@shopify/polaris';

export function CardExample() {
  return (
    <Card title="Sales This Quarter" sectioned>
      <BlockStack gap="200">
        <Text as="p">$10,250 (↑ 12% from last quarter)</Text>
      </BlockStack>
    </Card>
  );
}
```

**Props:**
- `title`: string | ReactNode
- `subtitle`: string
- `sectioned`: boolean (adds padding)
- `padding`: "0" | "200" | "400"
- `background`: "bg-surface" | "bg-fill"
- `children`: ReactNode

### IndexTable (Data Table)

```tsx
import {
  IndexTable,
  useIndexResourceState,
  Button,
  Text,
} from '@shopify/polaris';
import { useState } from 'react';

export function DataTable() {
  const products = [
    { id: '1', name: 'Widget A', price: '$29.99', status: 'Active' },
    { id: '2', name: 'Widget B', price: '$39.99', status: 'Draft' },
  ];

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products);

  return (
    <IndexTable
      resourceName={{ singular: 'product', plural: 'products' }}
      itemCount={products.length}
      selectedItemsCount={
        allResourcesSelected ? 'All' : selectedResources.length
      }
      onSelectionChange={handleSelectionChange}
      headings={[
        { title: 'Name' },
        { title: 'Price' },
        { title: 'Status' },
      ]}
    >
      {products.map((product) => (
        <IndexTable.Row
          key={product.id}
          id={product.id}
          selected={selectedResources.includes(product.id)}
        >
          <IndexTable.Cell>{product.name}</IndexTable.Cell>
          <IndexTable.Cell>{product.price}</IndexTable.Cell>
          <IndexTable.Cell>{product.status}</IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );
}
```

**Key Props:**
- `resourceName`: { singular: string; plural: string }
- `itemCount`: number (total items)
- `selectedItemsCount`: number | "All"
- `onSelectionChange`: (selected) => void
- `headings`: { title: string }[]

### ResourceList

```tsx
import { ResourceList, ResourceItem, Text, Button } from '@shopify/polaris';

export function ListExample() {
  const items = [
    { id: '1', name: 'Product A', status: 'Active' },
    { id: '2', name: 'Product B', status: 'Draft' },
  ];

  return (
    <ResourceList
      resourceName={{ singular: 'product', plural: 'products' }}
      items={items}
      renderItem={(item) => (
        <ResourceItem
          id={item.id}
          accessibilityLabel={`View product ${item.name}`}
        >
          <Text variant="bodyMd" as="span">
            {item.name}
          </Text>
          <Text variant="bodySm" as="span" tone="subdued">
            {item.status}
          </Text>
        </ResourceItem>
      )}
    />
  );
}
```

---

## Modal & Overlay Components

### Modal

```tsx
import { Modal, Button, TextField, BlockStack } from '@shopify/polaris';
import { useState } from 'react';

export function ModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Create Product"
        primaryAction={{
          content: 'Save',
          onAction: () => {
            console.log('Save clicked');
            setIsOpen(false);
          },
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField label="Product Name" />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
```

**Props:**
- `open`: boolean
- `onClose`: () => void
- `title`: string | ReactNode
- `primaryAction`: { content: string; onAction: () => void; loading?: boolean; disabled?: boolean }
- `secondaryActions`: same shape as primaryAction (array)
- `children`: ReactNode (Modal.Section wrapper recommended)

### ContextualSaveBar (Sticky Footer)

```tsx
import { ContextualSaveBar, Button } from '@shopify/polaris';
import { useState } from 'react';

export function UnsavedChangesBar() {
  const [isDirty, setIsDirty] = useState(false);

  return (
    <>
      {isDirty && (
        <ContextualSaveBar
          message="Unsaved changes"
          saveAction={{
            onAction: () => {
              console.log('Save');
              setIsDirty(false);
            },
            loading: false,
            disabled: false,
          }}
          discardAction={{
            onAction: () => {
              console.log('Discard');
              setIsDirty(false);
            },
          }}
        />
      )}
      <Button onClick={() => setIsDirty(true)}>Make Change</Button>
    </>
  );
}
```

---

## Navigation & Routing

### Navigation Component

```tsx
import { Navigation } from '@shopify/polaris';
import { HomeIcon, ProductIcon, OrdersIcon } from '@shopify/polaris-icons';

export function AppNavigation() {
  return (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            url: '/',
            label: 'Dashboard',
            icon: HomeIcon,
          },
          {
            url: '/products',
            label: 'Products',
            icon: ProductIcon,
          },
          {
            url: '/orders',
            label: 'Orders',
            icon: OrdersIcon,
          },
        ]}
      />
    </Navigation>
  );
}
```

**Props:**
- `location`: string (current URL for active indicator)
- `children`: Navigation.Section (groups of items)
- Navigation.Section.items[]: { url: string; label: string; icon?: React.ComponentType; badge?: string }

---

## Icons & Iconography

### Using Polaris Icons

```tsx
import { Icon, Button, InlineStack } from '@shopify/polaris';
import {
  SaveIcon,
  DeleteIcon,
  SearchIcon,
  PlusIcon,
} from '@shopify/polaris-icons';

export function IconExamples() {
  return (
    <InlineStack gap="400">
      <Button icon={SaveIcon}>Save</Button>
      <Button icon={DeleteIcon} variant="primary">
        Delete
      </Button>
      <Icon source={SearchIcon} tone="base" />
    </InlineStack>
  );
}
```

**Common Icons:**
- SaveIcon, CancelIcon, DeleteIcon, EditIcon
- SearchIcon, FilterIcon, SortIcon
- PlusIcon, MinusIcon, ChevronDownIcon, ChevronRightIcon
- HomeIcon, ProductIcon, OrdersIcon, CustomerIcon
- CheckIcon, AlertIcon, InfoIcon, WarningIcon

**Icon Component Props:**
- `source`: React.ComponentType (the icon SVG)
- `tone`: "base" | "subdued" | "positive" | "warning" | "critical"
- `accessibilityLabel`: string

---

## Design Tokens & Theming

### Color Tokens

```
Primary: var(--p-color-interactive)
Success: var(--p-color-text-success)
Warning: var(--p-color-text-warning)
Critical: var(--p-color-text-critical)
Text: var(--p-color-text), var(--p-color-text-subdued)
Surface: var(--p-color-bg-surface), var(--p-color-bg-surface-secondary)
```

### Spacing Values

```
100: 0.25rem (4px)
200: 0.5rem (8px)
300: 1rem (16px)
400: 1.5rem (24px)
500: 2rem (32px)
600: 2.5rem (40px)
700: 3rem (48px)
```

### Typography

```
Display: font-size 2rem, font-weight 600 (headings)
Heading: font-size 1.5rem, font-weight 600 (titles)
BodyLg: font-size 1rem, font-weight 400 (body text)
BodyMd: font-size 0.875rem, font-weight 400 (default body)
BodySm: font-size 0.8125rem, font-weight 400 (secondary text)
Code: monospace, 0.875rem
```

### Using in Custom CSS

```css
.custom-box {
  background: var(--p-color-bg-surface);
  color: var(--p-color-text);
  padding: var(--p-space-300);
  border-radius: var(--p-border-radius-base);
}
```

---

## Worked Example: Product Management App

```tsx
import React, { useState } from 'react';
import {
  AppProvider,
  Page,
  Layout,
  Card,
  IndexTable,
  Button,
  Modal,
  TextField,
  FormLayout,
  InlineStack,
  useIndexResourceState,
  BlockStack,
  Text,
} from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import '@shopify/polaris/build/esm/styles.css';

export function ProductApp() {
  const [products, setProducts] = useState([
    { id: '1', name: 'Widget A', price: '$29.99', status: 'Active' },
    { id: '2', name: 'Widget B', price: '$39.99', status: 'Draft' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '' });
  const [errors, setErrors] = useState({});

  const { selectedResources, handleSelectionChange } =
    useIndexResourceState(products);

  const handleAddProduct = () => {
    setErrors({});
    if (!newProduct.name) {
      setErrors({ name: 'Product name is required' });
      return;
    }
    setProducts([
      ...products,
      {
        id: String(Date.now()),
        name: newProduct.name,
        price: newProduct.price || '$0.00',
        status: 'Draft',
      },
    ]);
    setNewProduct({ name: '', price: '' });
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    setProducts(
      products.filter((p) => !selectedResources.includes(p.id))
    );
  };

  return (
    <AppProvider i18n={{}}>
      <Page
        title="Products"
        subtitle="Manage your product catalog"
        primaryAction={{
          content: 'Add Product',
          icon: PlusIcon,
          onAction: () => setIsModalOpen(true),
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              {selectedResources.length > 0 && (
                <Card.Section>
                  <InlineStack gap="400">
                    <Text as="p" tone="subdued">
                      {selectedResources.length} selected
                    </Text>
                    <Button
                      variant="primary"
                      tone="critical"
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                  </InlineStack>
                </Card.Section>
              )}
              <IndexTable
                resourceName={{ singular: 'product', plural: 'products' }}
                itemCount={products.length}
                selectedItemsCount={selectedResources.length}
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: 'Name' },
                  { title: 'Price' },
                  { title: 'Status' },
                ]}
              >
                {products.map((product) => (
                  <IndexTable.Row
                    key={product.id}
                    id={product.id}
                    selected={selectedResources.includes(product.id)}
                  >
                    <IndexTable.Cell>{product.name}</IndexTable.Cell>
                    <IndexTable.Cell>{product.price}</IndexTable.Cell>
                    <IndexTable.Cell>{product.status}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>
          </Layout.Section>
        </Layout>

        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add Product"
          primaryAction={{
            content: 'Save',
            onAction: handleAddProduct,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setIsModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Product Name"
                value={newProduct.name}
                onChange={(value) =>
                  setNewProduct({ ...newProduct, name: value })
                }
                error={errors.name}
                requiredIndicator
              />
              <TextField
                label="Price"
                value={newProduct.price}
                onChange={(value) =>
                  setNewProduct({ ...newProduct, price: value })
                }
                prefix="$"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Page>
    </AppProvider>
  );
}
```

---

## Accessibility Best Practices

- Always provide semantic `label` props to form inputs
- Use `requiredIndicator` for required fields
- Provide `helpText` to clarify input expectations
- Use descriptive button labels; avoid "Click here"
- Set `accessibilityLabel` on icon-only buttons
- Use `ResourceItem.accessibilityLabel` for screen readers
- Use `tone` prop on Text and Icon for semantic color meaning, not just visual

---

## Common Patterns Checklist

- [ ] Wrap app in `<AppProvider>` with CSS import
- [ ] Use `BlockStack` for vertical layouts, `InlineStack` for horizontal
- [ ] Use `Card` to group related content
- [ ] Use `IndexTable` for tabular data, `ResourceList` for browseable items
- [ ] Use `Modal` for overlays; `ContextualSaveBar` for unsaved changes
- [ ] Import icons from `@shopify/polaris-icons`
- [ ] Validate form inputs and show `error` prop on invalid fields
- [ ] Use `formLayout` inside `<Form>` for proper spacing
- [ ] Use design token CSS variables for colors and spacing
- [ ] Test keyboard navigation (Tab, Enter, Escape) in all interactive components
