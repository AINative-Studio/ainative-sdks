export interface AINativeConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: Message;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CreditBalance {
  balance: number;
  currency: string;
  userId: string;
}

export interface AINativeError {
  message: string;
  code?: string;
  status?: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: AINativeError | null;
}

export interface CreditsState {
  balance: CreditBalance | null;
  isLoading: boolean;
  error: AINativeError | null;
}
