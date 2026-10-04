# @ainative/svelte-sdk

Official Svelte SDK for AINative Studio API - Reactive stores for chat completions and credit management.

[![npm version](https://badge.fury.io/js/%40ainative%2Fsvelte-sdk.svg)](https://www.npmjs.com/package/@ainative/svelte-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎯 **Svelte Stores** - Reactive stores that integrate seamlessly with Svelte
- 💬 **Chat Completions** - Stream AI responses with `createChat()`
- 💰 **Credit Management** - Track balance with `createCredits()`
- 📘 **TypeScript** - Full type safety with TypeScript definitions
- 🔄 **Reactive** - Built on Svelte's reactivity system
- 🪶 **Lightweight** - Minimal bundle size with tree-shaking support
- ⚡ **Svelte 4 & 5** - Compatible with both Svelte versions

## Installation

```bash
npm install @ainative/svelte-sdk
```

## Quick Start

### 1. Configure SDK

```typescript
// +layout.svelte or app initialization
<script lang="ts">
  import { setAINativeConfig } from '@ainative/svelte-sdk';
  import { onMount } from 'svelte';

  onMount(() => {
    setAINativeConfig({
      apiKey: 'your-api-key-here',
      baseUrl: 'https://api.ainative.studio' // optional
    });
  });
</script>
```

### 2. Use Chat Store

```svelte
<script lang="ts">
  import { createChat, type Message } from '@ainative/svelte-sdk';

  const chat = createChat({
    model: 'claude-3-5-sonnet-20241022'
  });

  let input = '';

  async function handleSubmit() {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input
    };

    try {
      await chat.sendMessage([...$chat.messages, userMessage]);
      input = '';
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }
</script>

<div class="chat-container">
  <div class="messages">
    {#each $chat.messages as msg}
      <div class="message-{msg.role}">
        <strong>{msg.role}:</strong> {msg.content}
      </div>
    {/each}
  </div>

  {#if $chat.error}
    <div class="error">{$chat.error.message}</div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <input
      bind:value={input}
      disabled={$chat.isLoading}
      placeholder="Type your message..."
    />
    <button type="submit" disabled={$chat.isLoading || !input.trim()}>
      {$chat.isLoading ? 'Sending...' : 'Send'}
    </button>
  </form>

  <button on:click={() => chat.reset()} type="button">
    Reset Chat
  </button>
</div>
```

### 3. Use Credits Store

```svelte
<script lang="ts">
  import { createCredits } from '@ainative/svelte-sdk';

  const credits = createCredits({
    autoFetch: true
  });
</script>

<div class="credits-display">
  {#if $credits.isLoading}
    <div>Loading balance...</div>
  {:else if $credits.error}
    <div class="error">{$credits.error.message}</div>
  {:else if $credits.balance}
    <div>
      <p>Balance: {$credits.balance.balance} {$credits.balance.currency}</p>
      <p>User ID: {$credits.balance.userId}</p>
    </div>
  {/if}

  <button on:click={() => credits.refetch()} disabled={$credits.isLoading}>
    Refresh Balance
  </button>
</div>
```

### Using Derived Stores

```svelte
<script lang="ts">
  import { createChat } from '@ainative/svelte-sdk';

  const chat = createChat();

  // Access derived stores directly
  const { messages, isLoading, error } = chat;
</script>

{#each $messages as msg}
  <div>{msg.content}</div>
{/each}

{#if $isLoading}
  <div>Loading...</div>
{/if}

{#if $error}
  <div>Error: {$error.message}</div>
{/if}
```

## Browser CORS Requirement

If you call the API directly from a browser origin (e.g. `http://localhost:5173`), that origin must be registered for your project. Otherwise the browser blocks the request at preflight and the stores fail with a generic network error:

- `TypeError: Failed to fetch`
- The request is blocked before `POST .../managed/chat/completions` is ever sent

This is expected browser CORS behavior when your origin isn't allowlisted — it is not a bug in the store. Command-line tools like `curl` don't enforce browser CORS, so a request can succeed there while failing in the browser until the origin is registered.

**To fix:** register your app's exact origin (scheme + host + port) for your project:

```bash
curl -X POST "https://api.ainative.studio/api/v1/projects/{project_id}/cors-origins" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"origin": "http://localhost:5173"}'
```

## API Reference

### `setAINativeConfig(config)`

Configure the SDK with your API key and optional base URL.

```typescript
import { setAINativeConfig } from '@ainative/svelte-sdk';

setAINativeConfig({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.ainative.studio' // optional
});
```

### `createChat(options?)`

Create a reactive chat store for managing conversations.

**Options:**
- `initialMessages?: Message[]` - Initial conversation messages
- `model?: string` - AI model to use (default: `claude-3-5-sonnet-20241022`)

**Returns:**
- Store with `messages`, `isLoading`, `error` (derived stores)
- `sendMessage(messages: Message[])` - Send messages
- `reset()` - Reset conversation

### `createCredits(options?)`

Create a reactive credits store for monitoring balance.

**Options:**
- `autoFetch?: boolean` - Automatically fetch on creation (default: `false`)

**Returns:**
- Store with `balance`, `isLoading`, `error` (derived stores)
- `refetch()` - Manually refetch balance

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  AINativeConfig,
  Message,
  ChatCompletionResponse,
  CreditBalance,
  AINativeError,
  ChatOptions,
  CreditsOptions
} from '@ainative/svelte-sdk';
```

## SvelteKit Integration

```typescript
// src/routes/+layout.ts
import { setAINativeConfig } from '@ainative/svelte-sdk';
import { PUBLIC_AINATIVE_API_KEY } from '$env/static/public';

export const load = () => {
  setAINativeConfig({
    apiKey: PUBLIC_AINATIVE_API_KEY
  });
};
```

## Examples

See the `/examples` directory for complete example applications:

- Basic chat application
- Credit monitoring dashboard
- Multi-model comparison
- SvelteKit integration

## License

MIT © AINative Studio

## Support

- **Documentation**: https://api.ainative.studio/docs
- **Email**: support@ainative.studio
- **Discord**: https://discord.com/invite/paipalooza
- **Issues**: https://github.com/AINative-Studio/ainative-sdks/issues
