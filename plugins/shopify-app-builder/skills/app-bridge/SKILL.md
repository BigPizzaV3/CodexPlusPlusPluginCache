---
name: app-bridge
description: "When asked to build Shopify admin apps, use App Bridge 4.x web components, shopify global API, session tokens, JWT validation, and migrations from 3.x. Covers CDN setup, all 8 web components, resource picker API, React hooks, backend JWT validation, and 5 worked examples."
---

# Shopify App Bridge 4.x: Web Components, Sessions & Admin Apps

## When Asked...

- **"Build a Shopify admin app"** → Use App Bridge 4.x with web components; load via CDN with data-api-key; use shopify global object for actions
- **"Add save/cancel buttons"** → Use `<ui-save-bar>` web component with data-primary-action and data-secondary-action attributes
- **"Show a confirmation modal"** → Use `<ui-modal>` web component with data-open attribute and slot-based content
- **"Display success message"** → Use `shopify.toast()` method with title, message, duration, isError flags
- **"Let user pick products/customers"** → Use resource picker API: `shopify.resourcePicker({ type: 'product' })`
- **"Validate backend requests"** → Exchange session token for JWT; verify JWT signature with Shopify's public key
- **"Upgrade from App Bridge 3.x"** → Follow migration checklist: remove AppProvider, update component usage, use web components directly

## App Bridge 4.x Architecture

App Bridge 4.x is a **web components-first framework**. The major shift from 3.x:
- **No AppProvider needed** — directly use web components and shopify global object
- **Native web components** — built-in elements like `<ui-modal>`, `<ui-save-bar>`, `<ui-toast>` instead of React/Vue wrappers
- **shopify global object** — replaces AppBridge context; provides toast(), modal(), navigate(), loading(), idToken(), etc.
- **Session tokens** — automatic JWT exchange for backend authentication
- **CDN-first delivery** — loaded via script tag with data-api-key; works in any HTML/framework

## Installation & CDN Setup

### CDN Script (Recommended for Admin Apps)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Admin App</title>
</head>
<body>
  <div id="app"></div>

  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key="YOUR_PUBLIC_API_KEY"
          data-host="{{ request.host }}">
  </script>

  <script>
    // shopify global object is now available
    console.log(shopify);
  </script>
</body>
</html>
```

**data-api-key**: Your Shopify public app API key (from shopify.app configuration)
**data-host**: Base64-encoded host parameter (usually `{{ request.host }}` in server templates)

### npm Package (for React/Node.js apps)

```bash
npm install @shopify/app-bridge @shopify/app-bridge-react
```

```typescript
import { initializeApp } from '@shopify/app-bridge';

const app = initializeApp({
  apiKey: process.env.REACT_APP_SHOPIFY_API_KEY,
  host: new URLSearchParams(location.search).get('host'),
});

console.log(window.shopify);
```

## shopify Global Object API

The **shopify global** provides the primary API for app interactions:

```typescript
// Toast notifications
shopify.toast({
  title: 'Success',
  message: 'Settings saved',
  duration: 3000,
  isError: false,
});

// Modal dialogs
shopify.modal.show({
  title: 'Confirm Action',
  message: 'Are you sure?',
  buttons: [
    { label: 'Cancel', type: 'secondary' },
    { label: 'Delete', type: 'primary', isDestructive: true },
  ],
});

// Navigation
shopify.navigate({ name: 'Admin::Product::Index' });
shopify.navigate({ url: '/admin/products/new' });

// Loading state
shopify.loading.dispatch(true);
shopify.loading.dispatch(false);

// Session token (JWT for backend calls)
const idToken = await shopify.idToken();

// Current app environment
shopify.environment // 'Admin' | 'Checkout' | 'Mobile' | 'POS'
shopify.config // { apiKey, host, theme }

// Deep linking
shopify.actions.Admin?.navigate({ path: '/products' });
```

## Web Components API

App Bridge 4.x provides 8 native web components. Use them directly in HTML without React wrappers.

### 1. `<ui-title-bar>` — Page Header

```html
<ui-title-bar>
  <h1 slot="title">Bulk Product Editor</h1>
  <button slot="secondary-actions">Help</button>
  <button slot="primary-action" onclick="saveProducts()">Save</button>
</ui-title-bar>
```

**Attributes**:
- `title` (slot) — Page title
- `primary-action` (slot) — Right-aligned primary button
- `secondary-actions` (slot) — Right-aligned secondary buttons

### 2. `<ui-save-bar>` — Sticky Save/Discard

```html
<ui-save-bar
  data-primary-action="Save"
  data-secondary-action="Discard"
  data-save-action-loading="false"
  onprimaryaction="handleSave(event)"
  onsecondaryaction="handleDiscard(event)">
</ui-save-bar>

<script>
  async function handleSave(event) {
    event.preventDefault();
    const token = await shopify.idToken();
    const formData = new FormData(document.querySelector('form'));

    const res = await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.ok) {
      shopify.toast({ title: 'Saved' });
      document.getElementById('form').classList.remove('dirty');
    }
  }
</script>
```

**Attributes**:
- `data-primary-action` — Button label (default: "Save")
- `data-secondary-action` — Discard label (default: "Discard")
- `data-save-action-loading` — Show spinner on primary button
- `onprimaryaction` — Fired when save clicked
- `onsecondaryaction` — Fired when discard clicked

### 3. `<ui-modal>` — Dialog Box

```html
<ui-modal data-open="true" data-title="Delete Product">
  <p>This action cannot be undone.</p>
  <button slot="primary-action" onclick="confirmDelete()">Delete</button>
  <button slot="secondary-action" onclick="closeModal()">Cancel</button>
</ui-modal>

<script>
  async function confirmDelete() {
    const token = await shopify.idToken();
    const res = await fetch('/api/products/123', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.ok) {
      shopify.toast({ title: 'Deleted' });
      document.querySelector('ui-modal').setAttribute('data-open', 'false');
    }
  }
</script>
```

**Attributes**:
- `data-open` — Show/hide ("true" or "false")
- `data-title` — Modal title
- `primary-action` (slot) — Primary button
- `secondary-action` (slot) — Secondary button

### 4. `<ui-toast>` — Toast Notification (Alternative)

```html
<ui-toast
  data-message="Settings updated"
  data-duration="3000"
  data-is-error="false"
  data-open="true">
</ui-toast>

<script>
  function showSuccess() {
    const toast = document.querySelector('ui-toast');
    toast.setAttribute('data-message', 'Successfully saved');
    toast.setAttribute('data-open', 'true');
    setTimeout(() => toast.setAttribute('data-open', 'false'), 3000);
  }
</script>
```

### 5. `<ui-nav-menu>` — Sidebar Navigation

```html
<ui-nav-menu>
  <a href="/dashboard" slot="item">Dashboard</a>
  <a href="/products" slot="item" data-active="true">Products</a>
  <a href="/orders" slot="item">Orders</a>
  <a href="/settings" slot="item">Settings</a>
</ui-nav-menu>
```

### 6. `<ui-resource-picker>` — Product/Collection Picker UI

```html
<ui-resource-picker
  data-type="product"
  data-selectable="multiple"
  data-can-query-for-more="true"
  onchange="handleResourceSelect(event)">
</ui-resource-picker>
```

### 7. `<ui-print-action>` — Print Button

```html
<ui-print-action onclick="window.print()">
  Print Invoice
</ui-print-action>
```

### 8. `<s-page>` — Full-Page Container

```html
<s-page>
  <ui-title-bar>
    <h1 slot="title">Dashboard</h1>
  </ui-title-bar>

  <div style="padding: 20px;">
    <h2>Welcome</h2>
  </div>
</s-page>
```

## Resource Picker API (Programmatic)

For programmatic access without UI component:

```typescript
// Product picker
await shopify.resourcePicker({
  type: 'product',
  selectionIds: [{ gid: 'gid://shopify/Product/123' }],
  onSelection(resources) {
    console.log('Selected:', resources.selection);
  },
  onCancel() {
    console.log('Picker cancelled');
  },
});

// Collection picker
await shopify.resourcePicker({
  type: 'collection',
  onSelection(resources) {
    // Handle selection
  },
});

// Customer picker
await shopify.resourcePicker({
  type: 'customer',
  onSelection(resources) {
    const customer = resources.selection[0];
    console.log(customer.id, customer.email);
  },
});

// Variant picker
await shopify.resourcePicker({
  type: 'variant',
  onSelection(resources) {
    const variant = resources.selection[0];
    console.log(variant.id, variant.title, variant.price);
  },
});
```

**Supported types**: `product`, `collection`, `customer`, `variant`, `draft_order`

## App Bridge React Hooks (Optional)

For React apps, optional hooks simplify shopify global access:

```typescript
import { useAppBridge } from '@shopify/app-bridge-react';
import { Toast } from '@shopify/app-bridge/actions';

export function MyComponent() {
  const app = useAppBridge();

  const handleSave = async () => {
    app.dispatch({ type: 'LOADING_DISPATCH', payload: true });
    const token = await app.getSessionToken();

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    app.dispatch({ type: 'LOADING_DISPATCH', payload: false });

    app.dispatch(Toast.create({
      title: 'Saved',
      message: 'Settings updated',
      duration: 3000,
    }));
  };

  return <button onClick={handleSave}>Save</button>;
}
```

## Session Token & JWT Backend Validation

App Bridge automatically provides session tokens (JWTs) for authenticated backend calls.

### Client Side: Get Token & Send

```javascript
const idToken = await shopify.idToken();

const response = await fetch('/api/admin/settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  body: JSON.stringify({ theme_color: '#FF0000' }),
});

if (!response.ok) {
  shopify.toast({
    title: 'Error',
    message: 'Failed to save settings',
    isError: true,
  });
}
```

### Backend Side: Validate JWT

**Node.js/Express**:

```typescript
import { jwtDecode } from 'jwt-decode';

async function validateSessionToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwtDecode(token);

    if (!decoded.iss || !decoded.iss.includes('shopify.com')) {
      throw new Error('Invalid issuer');
    }

    if (!decoded.aud || decoded.aud !== process.env.SHOPIFY_API_KEY) {
      throw new Error('Invalid audience');
    }

    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      throw new Error('Token expired');
    }

    req.shop = decoded.dest;
    req.userId = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/admin/settings', validateSessionToken, (req, res) => {
  console.log(`User ${req.userId} from shop ${req.shop} updating settings`);
  res.json({ success: true });
});
```

**Python/Flask**:

```python
from flask import request, jsonify
from jwt import decode as jwt_decode
from functools import wraps

def validate_session_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401

        token = auth_header[7:]

        try:
            decoded = jwt_decode(token, options={"verify_signature": False})

            if not decoded.get('iss') or 'shopify.com' not in decoded['iss']:
                raise ValueError('Invalid issuer')

            if decoded.get('aud') != os.getenv('SHOPIFY_API_KEY'):
                raise ValueError('Invalid audience')

            request.shop = decoded.get('dest')
            request.user_id = decoded.get('sub')
            return f(*args, **kwargs)

        except Exception as e:
            return jsonify({'error': 'Invalid token'}), 401

    return decorated_function

@app.post('/api/admin/settings')
@validate_session_token
def update_settings():
    shop = request.shop
    user_id = request.user_id
    data = request.get_json()
    return jsonify({'success': True})
```

## Worked Examples

### Example 1: Save Bar with Form Validation

```html
<!DOCTYPE html>
<html>
<body>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key="pk_test_12345"
          data-host="example.myshopify.com">
  </script>

  <ui-title-bar>
    <h1 slot="title">Product Settings</h1>
  </ui-title-bar>

  <form id="settings-form" style="padding: 20px; max-width: 600px;">
    <label>
      Product Name
      <input type="text" name="product_name" required>
    </label>
    <br><br>

    <label>
      Price
      <input type="number" name="price" step="0.01" required>
    </label>
    <br><br>

    <label>
      Description
      <textarea name="description"></textarea>
    </label>
  </form>

  <ui-save-bar
    data-primary-action="Save Changes"
    data-secondary-action="Discard"
    onprimaryaction="handleSave(event)"
    onsecondaryaction="handleDiscard(event)">
  </ui-save-bar>

  <script>
    const form = document.getElementById('settings-form');

    form.addEventListener('change', () => {
      form.classList.add('dirty');
    });

    async function handleSave(event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        shopify.toast({
          title: 'Validation Error',
          message: 'Please fill all required fields',
          isError: true,
        });
        return;
      }

      const token = await shopify.idToken();
      const formData = new FormData(form);

      try {
        const response = await fetch('/api/products/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(Object.fromEntries(formData)),
        });

        if (!response.ok) throw new Error('Save failed');

        shopify.toast({
          title: 'Success',
          message: 'Product settings saved',
        });
        form.classList.remove('dirty');
      } catch (err) {
        shopify.toast({
          title: 'Error',
          message: err.message,
          isError: true,
        });
      }
    }

    function handleDiscard(event) {
      event.preventDefault();
      form.reset();
      form.classList.remove('dirty');
    }
  </script>
</body>
</html>
```

### Example 2: Destructive Modal (Delete Confirmation)

```typescript
async function showDeleteConfirmation(productId: string) {
  const modal = document.createElement('ui-modal');
  modal.setAttribute('data-open', 'true');
  modal.setAttribute('data-title', 'Delete Product');

  const content = document.createElement('p');
  content.textContent = 'This action cannot be undone.';

  const confirmBtn = document.createElement('button');
  confirmBtn.setAttribute('slot', 'primary-action');
  confirmBtn.textContent = 'Delete';

  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('slot', 'secondary-action');
  cancelBtn.textContent = 'Cancel';

  modal.appendChild(content);
  modal.appendChild(confirmBtn);
  modal.appendChild(cancelBtn);
  document.body.appendChild(modal);

  confirmBtn.onclick = async () => {
    shopify.loading.dispatch(true);
    const token = await shopify.idToken();

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      shopify.loading.dispatch(false);
      modal.setAttribute('data-open', 'false');

      shopify.toast({
        title: 'Product Deleted',
        message: 'The product has been permanently removed',
      });

      shopify.navigate({ name: 'Admin::Product::Index' });
    } catch (err) {
      shopify.loading.dispatch(false);
      shopify.toast({
        title: 'Error',
        message: `Failed to delete: ${err.message}`,
        isError: true,
      });
    }
  };

  cancelBtn.onclick = () => {
    modal.setAttribute('data-open', 'false');
    modal.remove();
  };
}
```

### Example 3: Product Resource Picker

```typescript
async function openProductSelector() {
  try {
    await shopify.resourcePicker({
      type: 'product',
      selectionIds: [],
      onSelection(resources) {
        const products = resources.selection;

        products.forEach(product => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 10px; border: 1px solid #ddd; margin: 5px 0;';
          item.innerHTML = `
            <strong>${product.title}</strong><br>
            ID: ${product.id}<br>
            <img src="${product.image?.originalSrc}" style="width: 50px;">
          `;
          document.getElementById('product-list').appendChild(item);
        });

        shopify.toast({
          title: 'Success',
          message: `${products.length} products selected`,
        });
      },
      onCancel() {
        shopify.toast({
          title: 'Cancelled',
          message: 'Product selection cancelled',
        });
      },
    });
  } catch (err) {
    shopify.toast({
      title: 'Error',
      message: `Failed to open picker: ${err.message}`,
      isError: true,
    });
  }
}
```

### Example 4: Toast on Success with Error Handling

```typescript
async function bulkUpdateProducts(productIds: string[]) {
  shopify.loading.dispatch(true);
  const token = await shopify.idToken();

  const results = { success: 0, failed: 0 };

  for (const productId of productIds) {
    try {
      const res = await fetch(`/api/products/${productId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ syncInventory: true }),
      });

      if (res.ok) results.success++;
      else results.failed++;
    } catch (err) {
      results.failed++;
    }
  }

  shopify.loading.dispatch(false);

  const message = results.failed > 0
    ? `${results.success} succeeded, ${results.failed} failed`
    : `All ${results.success} products synced`;

  shopify.toast({
    title: 'Bulk Update Complete',
    message,
    isError: results.failed > 0,
    duration: 5000,
  });
}
```

### Example 5: Navigation Menu & Routing

```typescript
function setupNavigation() {
  const navMenu = document.querySelector('ui-nav-menu');
  const routes = [
    { path: '/dashboard', label: 'Dashboard', icon: 'home' },
    { path: '/products', label: 'Products', icon: 'package' },
    { path: '/orders', label: 'Orders', icon: 'bag' },
    { path: '/settings', label: 'Settings', icon: 'gear' },
  ];

  routes.forEach(route => {
    const link = document.createElement('a');
    link.href = route.path;
    link.setAttribute('slot', 'item');
    link.textContent = route.label;

    if (window.location.pathname === route.path) {
      link.setAttribute('data-active', 'true');
    }

    link.addEventListener('click', (e) => {
      e.preventDefault();
      navMenu.querySelectorAll('a').forEach(a => a.removeAttribute('data-active'));
      link.setAttribute('data-active', 'true');
      shopify.navigate({ url: route.path });
    });

    navMenu.appendChild(link);
  });
}

setupNavigation();
```

## Migration Checklist: App Bridge 3.x → 4.x

1. **Remove AppProvider** — No longer needed; shopify global is auto-initialized
2. **Update web component imports** — Use native `<ui-*>` elements instead of React wrappers
3. **Replace useAppBridge hook** — Use `window.shopify` or optional `useAppBridge()` hook from React package
4. **Update toast/modal calls** — `shopify.toast()` and `shopify.modal.show()` instead of Toast/Modal actions
5. **Session tokens automatic** — No need to manually request; `shopify.idToken()` handles refresh
6. **Update resource picker** — Use `shopify.resourcePicker()` API or `<ui-resource-picker>` component
7. **Test JWT validation** — Ensure backend correctly decodes and validates JWTs

## Frame Ancestors & CSP Setup

Configure Content Security Policy to allow App Bridge:

```html
<meta http-equiv="Content-Security-Policy"
      content="frame-ancestors https://admin.shopify.com https://*.myshopify.com;">
```

Or in server headers (Express.js example):

```typescript
app.use((req, res, next) => {
  res.set('Frame-Ancestors', 'https://admin.shopify.com https://*.myshopify.com');
  next();
});
```

This allows your app to be embedded in Shopify Admin iframe.
