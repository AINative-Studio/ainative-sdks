/**
 * AINative React SDK
 *
 * Official React SDK for AINative Studio API.
 * Provides simple hooks for chat completions, credit management,
 * agent lifecycle, swarm tasks, ZeroMemory, and conversation threads.
 */

// Provider
export { AINativeProvider } from './AINativeProvider';

// Hooks
export { useAINative } from './hooks/useAINative';
export { useChat } from './hooks/useChat';
export { useCredits } from './hooks/useCredits';
export { useAgent } from './hooks/useAgent';
export { useTask } from './hooks/useTask';
export { useMemory } from './hooks/useMemory';
export { useThread } from './hooks/useThread';

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

export type {
  AgentRegistration,
  CreateAgentRequest,
  UseAgentReturn,
} from './hooks/useAgent';

export type {
  SwarmTask,
  SwarmTaskStatus,
  SubmitTaskRequest,
  UseTaskOptions,
  UseTaskReturn,
} from './hooks/useTask';

export type {
  Memory,
  RememberOptions,
  RecallOptions,
  UseMemoryReturn,
} from './hooks/useMemory';

export type {
  Thread,
  ThreadMessage,
  ThreadWithMessages,
  CreateThreadRequest,
  SearchMode,
  UseThreadReturn,
} from './hooks/useThread';
