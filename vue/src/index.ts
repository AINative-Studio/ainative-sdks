// Export composables
export { useAINative, AINativeConfigKey } from './composables/useAINative';
export { useChat } from './composables/useChat';
export { useCredits } from './composables/useCredits';

// Export types
export type {
  AINativeConfig,
  Message,
  ChatCompletionResponse,
  CreditBalance,
  AINativeError,
  ChatState,
  CreditsState,
} from './types';

export type { UseChatOptions, UseChatReturn } from './composables/useChat';
export type { UseCreditsOptions, UseCreditsReturn } from './composables/useCredits';
