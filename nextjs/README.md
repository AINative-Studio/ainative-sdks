# @ainative/next-sdk

Official Next.js SDK for AINative Studio API. Provides server and client utilities for both App Router and Pages Router.

## Features

- **Server Components**: Use `createServerClient()` in Server Components and Server Actions
- **Client Components**: Re-exports `@ainative/react-sdk` hooks for Client Components
- **API Routes**: Protect routes with `withAuth()` middleware
- **Session Management**: Extract JWT session from cookies
- **TypeScript**: Full type safety with TypeScript definitions
- **Zero Config**: Works out of the box with sensible defaults

## Installation

```bash
npm install @ainative/next-sdk
# or
yarn add @ainative/next-sdk
# or
pnpm add @ainative/next-sdk
```

## Quick Start

### App Router (Next.js 13+)

#### Server Component

```tsx
// app/dashboard/page.tsx
import { createServerClient, getApiKey } from '@ainative/next-sdk/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const apiKey = await getApiKey();

  if (!apiKey) {
    redirect('/login');
  }

  const client = createServerClient({ apiKey });
  const balance = await client.credits.balance();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Credits: {balance.remaining_credits}</p>
    </div>
  );
}
```

#### Client Component

```tsx
// app/chat/page.tsx
'use client';

import { AINativeProvider, useChat } from '@ainative/next-sdk/client';

export default function ChatPage({ apiKey }: { apiKey: string }) {
  return (
    <AINativeProvider config={{ apiKey }}>
      <ChatInterface />
    </AINativeProvider>
  );
}

function ChatInterface() {
  const { messages, isLoading, sendMessage } = useChat();

  return (
    <div>
      {messages.map((msg, idx) => (
        <div key={idx}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>
        Send
      </button>
    </div>
  );
}
```

#### API Route

```tsx
// app/api/chat/route.ts
import { withAuth, createServerClient } from '@ainative/next-sdk/server';
import { NextRequest } from 'next/server';

export const POST = withAuth(async (req: NextRequest, { session, apiKey }) => {
  const body = await req.json();
  const client = createServerClient({ apiKey });

  const response = await client.chat.completions.create({
    messages: body.messages,
  });

  return Response.json(response);
});
```

### Pages Router (Next.js 12)

#### Page with Server-Side Rendering

```tsx
// pages/dashboard.tsx
import { GetServerSideProps } from 'next';
import { getSessionFromCookie, createServerClient, getApiKeyFromCookie } from '@ainative/next-sdk/server';

export default function DashboardPage({ balance }) {
  return <div>Credits: {balance.remaining_credits}</div>;
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const session = getSessionFromCookie(req.headers.cookie);

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const apiKey = getApiKeyFromCookie(req.headers.cookie);
  const client = createServerClient({ apiKey });
  const balance = await client.credits.balance();

  return { props: { balance } };
};
```

#### API Route

```tsx
// pages/api/chat.ts
import { withAuthPages, createServerClient } from '@ainative/next-sdk/server';

export default withAuthPages(async (req, res, { session, apiKey }) => {
  const client = createServerClient({ apiKey });

  const response = await client.chat.completions.create({
    messages: req.body.messages,
  });

  res.status(200).json(response);
});
```

## API Reference

### Server Utilities

#### `createServerClient(config)`

Creates a server-side API client for use in Server Components, Server Actions, and API routes.

```typescript
import { createServerClient } from '@ainative/next-sdk/server';

const client = createServerClient({
  apiKey: 'your-jwt-token',
  baseUrl: 'https://api.ainative.studio/api/v1', // optional
});

// Chat completions
const response = await client.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
  preferred_model: 'gpt-3.5-turbo',
  temperature: 0.7,
});

// Credit balance
const balance = await client.credits.balance();
```

#### `getSession()` (App Router)

Gets session from cookies in App Router. Returns `Session | null`.

```typescript
import { getSession } from '@ainative/next-sdk/server';

const session = await getSession(); // default cookie: 'ainative_token'
const session = await getSession('custom_cookie'); // custom cookie name

if (session) {
  console.log(session.userId, session.email);
}
```

#### `getSessionFromCookie(cookieHeader)` (Pages Router)

Gets session from cookie header in Pages Router. Returns `Session | null`.

```typescript
import { getSessionFromCookie } from '@ainative/next-sdk/server';

const session = getSessionFromCookie(req.headers.cookie);
```

#### `getApiKey()` (App Router)

Gets JWT token from cookies. Returns `string | null`.

```typescript
import { getApiKey } from '@ainative/next-sdk/server';

const apiKey = await getApiKey();
```

#### `getApiKeyFromCookie(cookieHeader)` (Pages Router)

Gets JWT token from cookie header. Returns `string | null`.

```typescript
import { getApiKeyFromCookie } from '@ainative/next-sdk/server';

const apiKey = getApiKeyFromCookie(req.headers.cookie);
```

#### `withAuth(handler, options?)` (App Router)

Higher-order function to protect API routes in App Router.

```typescript
import { withAuth } from '@ainative/next-sdk/server';

export const POST = withAuth(async (req, { session, apiKey, params }) => {
  // session: Session object
  // apiKey: JWT token string
  // params: Route params (if any)

  return Response.json({ userId: session.userId });
}, {
  cookieName: 'ainative_token', // optional
});
```

#### `withAuthPages(handler, options?)` (Pages Router)

Higher-order function to protect API routes in Pages Router.

```typescript
import { withAuthPages } from '@ainative/next-sdk/server';

export default withAuthPages(async (req, res, { session, apiKey }) => {
  res.status(200).json({ userId: session.userId });
});
```

### Client Utilities

All client utilities are re-exported from `@ainative/react-sdk`:

- `AINativeProvider` - Provider component for client-side context
- `useAINative()` - Access API client in client components
- `useChat()` - Chat completion hook with state management
- `useCredits()` - Credit balance hook with auto-refresh

See [@ainative/react-sdk](https://www.npmjs.com/package/@ainative/react-sdk) for full documentation.

## Types

```typescript
import type {
  // Server types
  Session,
  ServerClient,
  ServerClientConfig,
  WithAuthOptions,

  // Client types
  AINativeConfig,
  Message,
  ChatCompletionRequest,
  ChatCompletionResponse,
  CreditBalance,
  ChatState,
} from '@ainative/next-sdk';
```

## Authentication

The SDK expects JWT tokens stored in cookies. By default, it looks for a cookie named `ainative_token`.

### Setting the Cookie

```typescript
// After login, set the JWT token as a cookie
import { cookies } from 'next/headers';

async function loginHandler(email: string, password: string) {
  // Authenticate with AINative API
  const response = await fetch('https://api.ainative.studio/api/v1/public/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const { access_token } = await response.json();

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set('ainative_token', access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}
```

### Custom Cookie Name

```typescript
// Use a custom cookie name
const session = await getSession('my_custom_token');
const apiKey = await getApiKey('my_custom_token');

export const POST = withAuth(handler, {
  cookieName: 'my_custom_token',
});
```

## Middleware Example

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('ainative_token')?.value;
  const isProtected = request.nextUrl.pathname.startsWith('/dashboard');

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

## Error Handling

```typescript
try {
  const client = createServerClient({ apiKey });
  const response = await client.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  console.error('API error:', error.message);
  // Handle error appropriately
}
```

## Environment Variables

```bash
# Optional: Override default API URL
NEXT_PUBLIC_AINATIVE_API_URL=https://api.ainative.studio/api/v1
```

## Requirements

- Next.js 13.0+ or 14.0+
- React 18.0+
- Node.js 18.0+

## Examples

See the [examples](./examples) directory for complete examples:

- [App Router examples](./examples/app-router)
- [Pages Router examples](./examples/pages-router)

## Contributing

See the main [repository](https://github.com/AINative-Studio/core) for contribution guidelines.

## License

MIT

## Support

- Documentation: https://ainative.studio/docs
- API Reference: https://api.ainative.studio/docs-enhanced
- Issues: https://github.com/AINative-Studio/core/issues
