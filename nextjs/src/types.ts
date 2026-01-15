/**
 * AINative Next.js SDK Type Definitions
 */

import type {
  ChatCompletionRequest as ReactChatCompletionRequest,
  ChatCompletionResponse as ReactChatCompletionResponse,
  CreditBalance as ReactCreditBalance,
} from '@ainative/react-sdk';

// Re-export React SDK types
export type {
  AINativeConfig,
  Message,
  ChatCompletionRequest,
  ChatCompletionResponse,
  CreditBalance,
  Usage,
  AINativeError,
  ChatState,
  UseChatOptions,
  UseCreditsReturn,
} from '@ainative/react-sdk';

/**
 * Session data extracted from JWT token
 */
export interface Session {
  userId: string;
  email: string;
  exp: number;
  iat: number;
}

/**
 * Server-side API client configuration
 */
export interface ServerClientConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Options for withAuth higher-order function
 */
export interface WithAuthOptions {
  cookieName?: string;
  redirectTo?: string;
}

/**
 * Next.js API route request with authentication
 */
export interface AuthenticatedRequest {
  session: Session;
  apiKey: string;
}

/**
 * Server-side API client for Next.js Server Components
 */
export interface ServerClient {
  chat: {
    completions: {
      create: (request: ReactChatCompletionRequest) => Promise<ReactChatCompletionResponse>;
    };
  };
  credits: {
    balance: () => Promise<ReactCreditBalance>;
  };
}
