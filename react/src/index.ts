/**
 * AINative React SDK
 *
 * Official React SDK for AINative Studio API.
 * Provides simple hooks for chat completions and credit management.
 */

// Provider
export { AINativeProvider } from './AINativeProvider';

// Hooks
export { useAINative } from './hooks/useAINative';
export { useChat } from './hooks/useChat';
export { useCredits } from './hooks/useCredits';

// Types
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
} from './types';
