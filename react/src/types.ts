/**
 * AINative React SDK Type Definitions
 */

export interface AINativeConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: Message[];
  preferred_model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  provider: string;
  created: number;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage: Usage;
  credits_consumed: number;
  credits_remaining: number;
  plan_tier: string;
  finish_reason: string;
}

export interface CreditBalance {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  plan: string;
  period_start: string;
  period_end: string | null;
  usage_percentage: number;
}

export interface AINativeError {
  message: string;
  status?: number;
  code?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: AINativeError | null;
  response: ChatCompletionResponse | null;
}

export interface UseChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  onError?: (error: AINativeError) => void;
  onSuccess?: (response: ChatCompletionResponse) => void;
}

export interface UseCreditsReturn {
  balance: CreditBalance | null;
  isLoading: boolean;
  error: AINativeError | null;
  refetch: () => Promise<void>;
}
