/**
 * AINative Next.js SDK - Client Components
 *
 * Client-side utilities for Next.js Client Components.
 * Re-exports all hooks and components from @ainative/react-sdk.
 */

// Re-export React SDK for client components
export {
  AINativeProvider,
  useAINative,
  useChat,
  useCredits,
} from '@ainative/react-sdk';

// Re-export types
export type {
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
