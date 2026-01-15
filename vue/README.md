# @ainative/vue-sdk

Official Vue SDK for AINative Studio API - Composables for chat completions and credit management.

[![npm version](https://badge.fury.io/js/%40ainative%2Fvue-sdk.svg)](https://www.npmjs.com/package/@ainative/vue-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎯 **Vue 3 Composition API** - Modern composables for seamless integration
- 💬 **Chat Completions** - Stream AI responses with `useChat()`
- 💰 **Credit Management** - Track balance with `useCredits()`
- 📘 **TypeScript** - Full type safety with TypeScript definitions
- 🔄 **Reactive** - Built on Vue's reactivity system
- 🪶 **Lightweight** - Minimal bundle size with tree-shaking support

## Installation

```bash
npm install @ainative/vue-sdk
```

## Quick Start

### 1. Provide Configuration

```typescript
// main.ts
import { createApp } from 'vue';
import { AINativeConfigKey } from '@ainative/vue-sdk';
import App from './App.vue';

const app = createApp(App);

app.provide(AINativeConfigKey, {
  apiKey: 'your-api-key-here',
  baseUrl: 'https://api.ainative.studio' // optional
});

app.mount('#app');
```

### 2. Use Chat Composable

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useChat, type Message } from '@ainative/vue-sdk';

const { messages, isLoading, error, sendMessage, reset } = useChat({
  model: 'claude-3-5-sonnet-20241022'
});

const input = ref('');

const handleSubmit = async () => {
  if (!input.value.trim()) return;

  const userMessage: Message = {
    role: 'user',
    content: input.value
  };

  try {
    await sendMessage([...messages.value, userMessage]);
    input.value = '';
  } catch (err) {
    console.error('Failed to send message:', err);
  }
};
</script>

<template>
  <div class="chat-container">
    <div class="messages">
      <div v-for="(msg, index) in messages" :key="index" :class="`message-${msg.role}`">
        <strong>{{ msg.role }}:</strong> {{ msg.content }}
      </div>
    </div>

    <div v-if="error" class="error">
      {{ error.message }}
    </div>

    <form @submit.prevent="handleSubmit">
      <input
        v-model="input"
        :disabled="isLoading"
        placeholder="Type your message..."
      />
      <button type="submit" :disabled="isLoading || !input.trim()">
        {{ isLoading ? 'Sending...' : 'Send' }}
      </button>
    </form>

    <button @click="reset" type="button">Reset Chat</button>
  </div>
</template>
```

### 3. Use Credits Composable

```vue
<script setup lang="ts">
import { useCredits } from '@ainative/vue-sdk';

const { balance, isLoading, error, refetch } = useCredits({
  autoFetch: true
});
</script>

<template>
  <div class="credits-display">
    <div v-if="isLoading">Loading balance...</div>
    <div v-else-if="error" class="error">{{ error.message }}</div>
    <div v-else-if="balance">
      <p>Balance: {{ balance.balance }} {{ balance.currency }}</p>
      <p>User ID: {{ balance.userId }}</p>
    </div>

    <button @click="refetch" :disabled="isLoading">
      Refresh Balance
    </button>
  </div>
</template>
```

## API Reference

### `useAINative()`

Access the SDK configuration provided at the app level.

```typescript
import { useAINative } from '@ainative/vue-sdk';

const config = useAINative();
console.log(config.apiKey, config.baseUrl);
```

### `useChat(options?)`

Manage chat conversations with AI models.

**Options:**
- `initialMessages?: Message[]` - Initial conversation messages
- `model?: string` - AI model to use (default: `claude-3-5-sonnet-20241022`)

**Returns:**
- `messages: Ref<Message[]>` - Chat message history
- `isLoading: Ref<boolean>` - Loading state
- `error: Ref<AINativeError | null>` - Error state
- `sendMessage: (messages: Message[]) => Promise<ChatCompletionResponse | null>` - Send messages
- `reset: () => void` - Reset conversation

### `useCredits(options?)`

Monitor credit balance.

**Options:**
- `autoFetch?: boolean` - Automatically fetch on mount (default: `true`)

**Returns:**
- `balance: Ref<CreditBalance | null>` - Credit balance
- `isLoading: Ref<boolean>` - Loading state
- `error: Ref<AINativeError | null>` - Error state
- `refetch: () => Promise<void>` - Manually refetch balance

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  AINativeConfig,
  Message,
  ChatCompletionResponse,
  CreditBalance,
  AINativeError,
  UseChatOptions,
  UseCreditsOptions
} from '@ainative/vue-sdk';
```

## Examples

See the `/examples` directory for complete example applications:

- Basic chat application
- Credit monitoring dashboard
- Multi-model comparison
- Chat with history persistence

## License

MIT © AINative Studio

## Support

- **Documentation**: https://api.ainative.studio/docs
- **Email**: support@ainative.studio
- **Discord**: https://discord.com/invite/paipalooza
- **Issues**: https://github.com/AINative-Studio/ainative-sdks/issues
