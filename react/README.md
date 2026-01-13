# @ainative/react-sdk

Official React SDK for AINative Studio API. Simple hooks for chat completions and credit management with TypeScript support.

## Installation

```bash
npm install @ainative/react-sdk
# or
yarn add @ainative/react-sdk
```

## Quick Start

```tsx
import { AINativeProvider, useChat, useCredits } from '@ainative/react-sdk';

function App() {
  return (
    <AINativeProvider config={{ apiKey: 'your-jwt-token' }}>
      <ChatComponent />
      <CreditsDisplay />
    </AINativeProvider>
  );
}

function ChatComponent() {
  const { messages, isLoading, error, sendMessage } = useChat({
    model: 'llama-3.3-70b-instruct',
    temperature: 0.7,
  });

  const handleSubmit = async (input: string) => {
    await sendMessage([
      ...messages,
      { role: 'user', content: input }
    ]);
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}

function CreditsDisplay() {
  const { balance, isLoading, error, refetch } = useCredits();

  if (isLoading) return <p>Loading credits...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h3>Credits: {balance?.remaining_credits}</h3>
      <p>Plan: {balance?.plan}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

## API Reference

### `<AINativeProvider>`

Provides API configuration to child components.

**Props:**

- `config` - Configuration object
  - `apiKey` (required) - Your JWT token from AINative authentication
  - `baseUrl` (optional) - API base URL (defaults to `https://api.ainative.studio/api/v1`)

**Example:**

```tsx
<AINativeProvider config={{
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  baseUrl: 'https://api.ainative.studio/api/v1'
}}>
  <YourApp />
</AINativeProvider>
```

### `useAINative()`

Returns the configured API client.

**Returns:**

```typescript
{
  config: AINativeConfig;
  baseUrl: string;
}
```

**Example:**

```tsx
function MyComponent() {
  const client = useAINative();
  console.log(client.baseUrl); // 'https://api.ainative.studio/api/v1'
}
```

### `useChat(options?)`

Manages chat completion state and provides methods to send messages.

**Options:**

- `model` (optional) - Preferred model name (e.g., `'llama-3.3-70b-instruct'`)
- `temperature` (optional) - Sampling temperature (0-2)
- `max_tokens` (optional) - Maximum tokens in response
- `onError` (optional) - Error callback
- `onSuccess` (optional) - Success callback

**Returns:**

```typescript
{
  messages: Message[];
  isLoading: boolean;
  error: AINativeError | null;
  response: ChatCompletionResponse | null;
  sendMessage: (messages: Message[]) => Promise<ChatCompletionResponse | null>;
  reset: () => void;
}
```

**Example:**

```tsx
function Chat() {
  const { messages, isLoading, sendMessage, reset } = useChat({
    model: 'llama-3.3-70b-instruct',
    temperature: 0.7,
    max_tokens: 1000,
    onSuccess: (response) => {
      console.log('Credits consumed:', response.credits_consumed);
    },
    onError: (error) => {
      if (error.status === 402) {
        alert('Insufficient credits!');
      }
    },
  });

  const handleSend = async (userInput: string) => {
    await sendMessage([
      ...messages,
      { role: 'user', content: userInput }
    ]);
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.role}: {msg.content}</div>
      ))}
      {isLoading && <div>Thinking...</div>}
      <button onClick={reset}>Clear Chat</button>
    </div>
  );
}
```

### `useCredits()`

Fetches and manages user credit balance.

**Returns:**

```typescript
{
  balance: CreditBalance | null;
  isLoading: boolean;
  error: AINativeError | null;
  refetch: () => Promise<void>;
}
```

**Example:**

```tsx
function Credits() {
  const { balance, isLoading, error, refetch } = useCredits();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Credits</h2>
      <p>Total: {balance?.total_credits}</p>
      <p>Used: {balance?.used_credits}</p>
      <p>Remaining: {balance?.remaining_credits}</p>
      <p>Plan: {balance?.plan}</p>
      <p>Usage: {balance?.usage_percentage}%</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

## TypeScript Types

The SDK exports all TypeScript types for your convenience:

```typescript
import type {
  AINativeConfig,
  Message,
  ChatCompletionRequest,
  ChatCompletionResponse,
  Usage,
  CreditBalance,
  AINativeError,
  ChatState,
  UseChatOptions,
  UseCreditsReturn,
} from '@ainative/react-sdk';
```

## Available Models

Model access depends on your subscription plan:

- **Free**: `llama-3.3-8b-instruct`
- **Basic**: `llama-3.3-8b-instruct`, `llama-3.3-70b-instruct`
- **Professional**: LLAMA models + `claude-sonnet-4.5`
- **Enterprise**: All models including `claude-opus-4`

## Error Handling

The SDK provides structured error handling:

```tsx
const { error } = useChat({
  onError: (error) => {
    switch (error.status) {
      case 402:
        console.error('Insufficient credits:', error.message);
        break;
      case 403:
        console.error('Model not available:', error.message);
        break;
      case 429:
        console.error('Rate limit exceeded:', error.message);
        break;
      default:
        console.error('API error:', error.message);
    }
  },
});
```

## Credit Costs

- **LLAMA 3.3-8B**: 0.1 base + 0.01 per 1K tokens
- **LLAMA 3.3-70B**: 0.5 base + 0.05 per 1K tokens
- **LLAMA 4 Maverick**: 1.0 base + 0.1 per 1K tokens
- **Claude Sonnet 4.5**: 2.0 base + 0.2 per 1K tokens
- **Claude Opus 4**: 5.0 base + 0.5 per 1K tokens

## Authentication

This SDK requires a JWT token from AINative authentication. You handle authentication separately and pass the token to the provider:

```tsx
// Your authentication logic
const token = await authenticateUser(email, password);

// Pass token to SDK
<AINativeProvider config={{ apiKey: token }}>
  <App />
</AINativeProvider>
```

## Requirements

- React 18.0.0 or higher
- Node.js 14.0.0 or higher

## Contributing

See the [main repository](https://github.com/AINative-Studio/core) for contribution guidelines.

## License

MIT

## Support

- Documentation: https://ainative.studio/docs
- API Reference: https://api.ainative.studio/docs-enhanced
- Issues: https://github.com/AINative-Studio/core/issues
- Email: support@ainative.studio
