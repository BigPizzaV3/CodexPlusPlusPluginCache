---
name: hydrogen-storefront
description: "Use this skill for Hydrogen 2026 Storefront Framework. Triggers include: 'hydrogen storefront', 'hydrogen 2026', 'hydrogen remix', 'shopify hydrogen framework', 'hydrogen setup scaffold', 'hydrogen useCart hook', 'hydrogen createCartHandler', 'hydrogen Customer Account API', 'hydrogen caching strategies', 'hydrogen oxygen deployment', 'hydrogen cli commands', 'hydrogen storefront client', 'hydrogen product page', 'hydrogen collection page', 'hydrogen checkout', 'hydrogen admin api', 'hydrogen queueApi', 'hydrogen analytics', 'hydrogen search implementation', 'hydrogen variants and options', 'hydrogen localization i18n', 'hydrogen performance optimization', 'hydrogen seo structured data', 'hydrogen third party scripts', 'hydrogen css styling tailwind', 'hydrogen testing'."
---

# Hydrogen 2026 Storefront Framework

Hydrogen is Shopify's Remix-based framework for building fast, custom storefronts. This skill covers Hydrogen 2026 project setup, the Storefront API client, cart management with hooks, Customer Account API, caching strategies, Oxygen deployment, CLI commands, and real-world PDP and collection page patterns.

## When Asked

**When asked to scaffold a new Hydrogen storefront:**
Provide the npm create @shopify/hydrogen command, explain project structure, and show how to configure .env with Storefront API credentials.

**When asked to fetch and display products:**
Use the Storefront API via the storefront client (GraphQL query), show how to load product details, variants, and media; explain caching strategies.

**When asked to implement a shopping cart:**
Use createCartHandler for backend cart mutations, useCart hook for frontend state, and explain line item management, discounts, and checkout flow.

**When asked about Customer Account API:**
Explain how to enable, authenticate with OAuth, and use for customer login, order history, account details, and profile updates.

**When asked to optimize performance and caching:**
Discuss Cache-Control headers, Oxygen runtime caching, request coalescing, and streaming SSR; provide cache strategy examples.

**When asked to deploy to Oxygen:**
Show CLI deployment steps (hydrogen deploy), environment variable setup, monitoring, and rollback procedures.

**When asked to implement search or filtering:**
Use Hydrogen Search API, faceting, filtering by attribute, and show autocomplete and collection filter patterns.

---

## Hydrogen 2026 Architecture Overview

Hydrogen provides:
- **Remix Framework**: Server-side rendering (SSR), file-based routing, loader/action functions, Remix utilities
- **Storefront API Client**: GraphQL client for fetching product, collection, cart, order, and customer data
- **useCart Hook**: Client-side cart state management with add-to-cart, update, remove operations
- **createCartHandler**: Server-side cart mutations (create, update, discount, checkout)
- **Customer Account API**: OAuth-based customer login, order history, account endpoints
- **Caching**: Cache-Control headers, Oxygen response caching, request deduplication
- **Oxygen Platform**: Serverless execution environment with global edge cache
- **CLI**: `hydrogen dev`, `hydrogen preview`, `hydrogen deploy` commands
- **Analytics & Reporting**: Built-in Oxygen analytics, custom event tracking

### Installation & Project Setup

```bash
npm create @shopify/hydrogen@latest my-store -- --language TypeScript
cd my-store
npm install
npm run dev
```

This generates:
```
my-store/
├── app/
│   ├── components/        # Reusable React components
│   ├── routes/            # File-based routing (Remix)
│   ├── lib/               # Utility functions, API clients
│   └── root.tsx           # Root layout
├── public/
├── .env                   # Storefront API token, store domain
├── hydrogen.config.ts     # Hydrogen config
├── remix.config.js        # Remix config (SSR, build)
├── package.json
└── tsconfig.json
```

### Environment Setup

```bash
# .env
PRIVATE_STOREFRONT_API_TOKEN=your_token_here
PUBLIC_STORE_DOMAIN=your-store.myshopify.com
SESSION_SECRET=random_string_min_32_chars
PRIVATE_CUSTOMER_ACCOUNT_API_TOKEN=customer_token
PUBLIC_CUSTOMER_ACCOUNT_API_URL=https://shopifyid.com/oauth/authorize
```

---

## Storefront API Client

### Initialize & Query

```typescript
// app/lib/shopify.server.ts
import { createStorefrontClient } from '@shopify/hydrogen';

export const storefront = createStorefrontClient({
  apiUrl: `https://${process.env.PUBLIC_STORE_DOMAIN}/api/2024-01/graphql.json`,
  apiVersion: '2024-01',
  privateStorefrontToken: process.env.PRIVATE_STOREFRONT_API_TOKEN!,
});
```

### Fetch Product Details

```typescript
// app/routes/products/$handle.tsx
import { json, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData } from '@remix-run/react';
import { storefront } from '~/lib/shopify.server';

const PRODUCT_QUERY = `
  query getProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      handle
      vendor
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 250) {
        edges {
          node {
            id
            title
            availableForSale
            selectedOptions {
              name
              value
            }
            priceV2 {
              amount
              currencyCode
            }
            image {
              url
              altText
            }
          }
        }
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
    }
  }
`;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle: params.handle },
    cache: context.storefront.CacheShort(),
  });

  if (!product) {
    throw new Response('Product not found', { status: 404 });
  }

  return json({ product });
}

export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      <div className="price-range">
        ${product.priceRange.minVariantPrice.amount} -
        ${product.priceRange.maxVariantPrice.amount}
      </div>
      {product.images.edges.map(({ node: image }) => (
        <img key={image.url} src={image.url} alt={image.altText} />
      ))}
    </div>
  );
}
```

### Fetch Collections

```typescript
const COLLECTIONS_QUERY = `
  query getCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          title
          handle
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

export async function loader({ context }: LoaderFunctionArgs) {
  const { collections } = await storefront.query(COLLECTIONS_QUERY, {
    variables: { first: 20 },
    cache: context.storefront.CacheLong(),
  });

  return json({ collections });
}
```

---

## Cart Management

### useCart Hook (Client-Side)

```typescript
// app/hooks/useCart.ts
import { useContext } from 'react';
import { CartContext } from '~/context/CartContext';

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

// Usage in component
import { useCart } from '~/hooks/useCart';

export function AddToCartButton({ variantId, quantity = 1 }) {
  const { addToCart, isLoading } = useCart();

  const handleClick = async () => {
    await addToCart({
      variantId,
      quantity,
    });
    // Show success toast
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Adding...' : 'Add to Cart'}
    </button>
  );
}
```

### createCartHandler (Server-Side)

```typescript
// app/lib/cart.server.ts
import { createCartHandler } from '@shopify/hydrogen';
import { storefront } from './shopify.server';

const CREATE_CART_MUTATION = `
  mutation createCart($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 10) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  priceV2 {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const cartHandler = createCartHandler({
  storefront,
  getCartId: async (request) => {
    // Retrieve cart ID from session or cookie
    const cartId = request.headers.get('x-cart-id');
    return cartId;
  },
  setCartId: async (request, cartId) => {
    // Store cart ID in session/cookie
    // This is called after cart is created
  },
  cartQueryFragment: `
    fragment CartApiFragment on Cart {
      id
      checkoutUrl
      totalQuantity
      cost {
        totalAmount {
          amount
          currencyCode
        }
        subtotalAmount {
          amount
        }
        totalTaxAmount {
          amount
        }
        totalDutyAmount {
          amount
        }
      }
      lines(first: $lineLimit) {
        edges {
          node {
            id
            quantity
            cost {
              totalAmount {
                amount
              }
            }
            merchandise {
              ... on ProductVariant {
                id
                title
                sku
                priceV2 {
                  amount
                }
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  `,
});

// Usage in action handler
export async function action({ request, context }: ActionFunctionArgs) {
  const cart = await cartHandler.queryCart(request, {
    variables: { lineLimit: 100 },
  });

  if (request.method === 'POST') {
    const formData = await request.formData();
    const variantId = formData.get('variantId');
    const quantity = parseInt(formData.get('quantity') || '1', 10);

    const updatedCart = await cartHandler.addToCart(request, {
      lines: [{ merchandiseId: variantId, quantity }],
    });

    return json({ cart: updatedCart });
  }

  return json({ cart });
}
```

### Cart Context Provider

```typescript
// app/context/CartContext.tsx
import { createContext, ReactNode, useState } from 'react';

interface CartContextType {
  cart: any | null;
  addToCart: (args: any) => Promise<void>;
  removeFromCart: (lineId: string) => Promise<void>;
  updateQuantity: (lineId: string, quantity: number) => Promise<void>;
  isLoading: boolean;
}

export const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const addToCart = async ({ variantId, quantity }: any) => {
    setIsLoading(true);
    const response = await fetch('/cart', {
      method: 'POST',
      body: JSON.stringify({ variantId, quantity }),
    });
    const { cart: newCart } = await response.json();
    setCart(newCart);
    setIsLoading(false);
  };

  const removeFromCart = async (lineId: string) => {
    setIsLoading(true);
    const response = await fetch('/cart', {
      method: 'DELETE',
      body: JSON.stringify({ lineId }),
    });
    const { cart: newCart } = await response.json();
    setCart(newCart);
    setIsLoading(false);
  };

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, isLoading }}
    >
      {children}
    </CartContext.Provider>
  );
}
```

---

## Customer Account API

### Enable & Setup

```typescript
// .env
PUBLIC_CUSTOMER_ACCOUNT_API_URL=https://shopifyid.com/oauth/authorize
PRIVATE_CUSTOMER_ACCOUNT_API_TOKEN=your_token
```

### Customer Login & Auth

```typescript
// app/routes/account/login.tsx
import { redirect } from '@shopify/remix-oxygen';

export async function loader({ context }: LoaderFunctionArgs) {
  const customerAccessToken = await getCustomerAccessToken(context);
  if (customerAccessToken) {
    return redirect('/account/profile');
  }
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    const { customerAccessToken, customerUserErrors } =
      await context.storefront.mutate(CUSTOMER_LOGIN_MUTATION, {
        variables: { email, password },
      });

    if (customerAccessToken?.accessToken) {
      // Store token in session
      const session = await getSession(request.headers.get('cookie'));
      session.set('customerAccessToken', customerAccessToken.accessToken);
      return redirect('/account/profile', {
        headers: { 'Set-Cookie': await commitSession(session) },
      });
    }

    return json({ errors: customerUserErrors });
  }
}

export default function LoginPage() {
  return (
    <form method="post">
      <input type="email" name="email" placeholder="Email" required />
      <input
        type="password"
        name="password"
        placeholder="Password"
        required
      />
      <button type="submit">Sign In</button>
    </form>
  );
}

const CUSTOMER_LOGIN_MUTATION = `
  mutation customerAccessTokenCreate(
    $input: CustomerAccessTokenCreateInput!
  ) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;
```

### Fetch Customer Profile

```typescript
// app/routes/account/profile.tsx
const CUSTOMER_QUERY = `
  query getCustomer($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      email
      firstName
      lastName
      phone
      defaultAddress {
        id
        formatted
        address1
        address2
        city
        province
        country
        zip
      }
      orders(first: 10) {
        edges {
          node {
            id
            orderNumber
            processedAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function loader({ request, context }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('cookie'));
  const customerAccessToken = session.get('customerAccessToken');

  if (!customerAccessToken) {
    return redirect('/account/login');
  }

  const { customer } = await context.storefront.query(CUSTOMER_QUERY, {
    variables: { customerAccessToken },
    cache: context.storefront.CacheShort(),
  });

  return json({ customer });
}

export default function ProfilePage() {
  const { customer } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Welcome, {customer.firstName}</h1>
      <p>Email: {customer.email}</p>
      <p>Phone: {customer.phone}</p>
      <h2>Recent Orders</h2>
      <ul>
        {customer.orders.edges.map(({ node: order }) => (
          <li key={order.id}>
            Order #{order.orderNumber} - $
            {order.totalPriceSet.shopMoney.amount}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Caching Strategies

### Cache-Control Headers

```typescript
// app/lib/cache.server.ts
export const CACHE_SHORT = () => ({
  'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hour
});

export const CACHE_LONG = () => ({
  'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
});

export const CACHE_NONE = () => ({
  'Cache-Control': 'no-cache, no-store, must-revalidate',
});

// Usage in loader
export async function loader({ context }: LoaderFunctionArgs) {
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle },
    cache: context.storefront.CacheShort(),
  });

  return json(
    { product },
    {
      headers: CACHE_SHORT(),
    }
  );
}
```

### Request Coalescing

Hydrogen automatically deduplicates identical requests made within the same render, preventing unnecessary API calls:

```typescript
// Both calls return same result without extra API calls
const [product1, product2] = await Promise.all([
  storefront.query(PRODUCT_QUERY, { variables: { handle: 'widget-a' } }),
  storefront.query(PRODUCT_QUERY, { variables: { handle: 'widget-a' } }),
]);
```

### Stale-While-Revalidate

```typescript
export const CACHE_SWR = () => ({
  'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
});
```

---

## Oxygen Deployment

### Build & Deploy

```bash
# Build locally
npm run build

# Deploy to Oxygen
hydrogen deploy

# Deploy with custom environment name
hydrogen deploy --env=staging

# View deployment logs
hydrogen deploy --logs
```

### Configuration

```typescript
// hydrogen.config.ts
import { defineConfig } from '@shopify/hydrogen/config';

export default defineConfig({
  storefront: {
    id: 'your-storefront-id',
    title: 'My Store',
    apiUrl: 'https://your-store.myshopify.com/api/2024-01/graphql.json',
  },
  oxygen: {
    preloadRequestCookie: [],
  },
});
```

### Environment Variables in Oxygen

Set via dashboard or CLI:
```bash
hydrogen deploy --set PRIVATE_STOREFRONT_API_TOKEN=token_value
```

---

## Hydrogen CLI Commands

```bash
# Local development
hydrogen dev                    # Start dev server (localhost:3000)
hydrogen dev --port 8080       # Custom port

# Preview production build
hydrogen preview                # Simulate production locally

# Build
npm run build                   # Build for production

# Deploy
hydrogen deploy                 # Deploy to Oxygen
hydrogen deploy --env=staging   # Deploy to named environment
hydrogen deploy --logs          # Show deployment logs

# Analytics
hydrogen analyze                # Analyze bundle size and performance

# Pull remote config
hydrogen config pull            # Fetch Storefront API config from dashboard
```

---

## Worked Example: Product Details Page (PDP)

```typescript
// app/routes/products/$handle.tsx
import { json, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import { storefront } from '~/lib/shopify.server';
import { AddToCartButton } from '~/components/AddToCartButton';

const PRODUCT_QUERY = `
  query getProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      handle
      vendor
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      options {
        name
        values
      }
      variants(first: 250) {
        edges {
          node {
            id
            title
            availableForSale
            selectedOptions {
              name
              value
            }
            priceV2 {
              amount
              currencyCode
            }
            image {
              url
              altText
              width
              height
            }
          }
        }
      }
      images(first: 20) {
        edges {
          node {
            url
            altText
            width
            height
          }
        }
      }
      seo {
        title
        description
      }
    }
  }
`;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle: params.handle },
    cache: context.storefront.CacheShort(),
  });

  if (!product) {
    throw new Response('Not Found', { status: 404 });
  }

  return json(
    { product },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    }
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data?.product?.seo?.title || data?.product?.title },
    { name: 'description', content: data?.product?.seo?.description },
  ];
};

export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants.edges[0].node
  );
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  const handleOptionChange = (optionName: string, value: string) => {
    const updated = { ...selectedOptions, [optionName]: value };
    setSelectedOptions(updated);

    // Find matching variant
    const matchingVariant = product.variants.edges.find(({ node }) =>
      node.selectedOptions.every(
        (opt) => updated[opt.name] === opt.value
      )
    )?.node;

    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
    }
  };

  return (
    <main className="product-page">
      <section className="gallery">
        <img
          src={selectedVariant.image?.url}
          alt={selectedVariant.image?.altText}
          width={selectedVariant.image?.width}
          height={selectedVariant.image?.height}
        />
      </section>

      <section className="details">
        <h1>{product.title}</h1>
        <p className="vendor">{product.vendor}</p>

        <div className="price">
          <span className="amount">${selectedVariant.priceV2.amount}</span>
        </div>

        <div className="description">
          {product.description}
        </div>

        {product.options.map((option) => (
          <fieldset key={option.name}>
            <legend>{option.name}</legend>
            <div className="options">
              {option.values.map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={option.name}
                    value={value}
                    checked={selectedOptions[option.name] === value}
                    onChange={() => handleOptionChange(option.name, value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <AddToCartButton
          variantId={selectedVariant.id}
          disabled={!selectedVariant.availableForSale}
        />
      </section>
    </main>
  );
}
```

---

## Performance Optimization Tips

- Use `CacheShort()` for product data (1 hour), `CacheLong()` for collections (24 hours)
- Enable streaming SSR for faster Time to First Byte (TTFB)
- Use `defer()` for non-critical data (recommendations, related products)
- Optimize images with responsive srcset and lazy loading
- Use Code Splitting for route components
- Monitor Core Web Vitals in Oxygen Analytics dashboard
- Use `<Image>` component from Hydrogen for automatic optimization

---

## Testing

```typescript
// app/__tests__/routes/products/$handle.test.tsx
import { loader } from '~/routes/products/$handle';

describe('Product Page Loader', () => {
  it('fetches product data', async () => {
    const mockContext = {
      storefront: {
        query: vi.fn().mockResolvedValue({
          product: { id: '123', title: 'Test Product' },
        }),
      },
    };

    const result = await loader({
      params: { handle: 'test-product' },
      context: mockContext,
    });

    expect(result).toBeDefined();
    expect(mockContext.storefront.query).toHaveBeenCalled();
  });
});
```

---

## Common Patterns Checklist

- [ ] Initialize Storefront API client with token and domain
- [ ] Use `CacheShort()` / `CacheLong()` for loader queries
- [ ] Fetch product variants and options for variant selection UI
- [ ] Implement cart add/update/remove via createCartHandler
- [ ] Wrap cart functionality with useCart hook
- [ ] Enable Customer Account API for customer login
- [ ] Set Cache-Control headers on response.json()
- [ ] Use file-based routing (Remix conventions)
- [ ] Test queries locally before deploying
- [ ] Monitor Oxygen Analytics for performance
- [ ] Use hydrogen preview to test production build locally
- [ ] Set environment variables via hydrogen deploy --set
