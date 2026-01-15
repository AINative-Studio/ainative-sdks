/**
 * Create server-side API client for Next.js Server Components
 */

import type {
  ServerClient,
  ServerClientConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  CreditBalance,
} from '../types';

/**
 * Create a server-side API client
 *
 * Use this in Server Components, Server Actions, and API routes.
 *
 * @param config - Client configuration with API key
 * @returns Server-side API client
 *
 * @example
 * ```tsx
 * // app/chat/page.tsx
 * import { createServerClient } from '@ainative/next-sdk/server';
 * import { getApiKey } from '@ainative/next-sdk/server';
 *
 * export default async function ChatPage() {
 *   const apiKey = await getApiKey();
 *   if (!apiKey) return <div>Not authenticated</div>;
 *
 *   const client = createServerClient({ apiKey });
 *   const balance = await client.credits.balance();
 *
 *   return <div>Credits: {balance.remaining_credits}</div>;
 * }
 * ```
 */
export function createServerClient(config: ServerClientConfig): ServerClient {
  const baseUrl = config.baseUrl || 'https://api.ainative.studio/api/v1';

  /**
   * Make authenticated API request
   */
  async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      })) as { message?: string };

      throw new Error(error.message || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    chat: {
      completions: {
        /**
         * Create chat completion
         */
        create: async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
          return fetchAPI<ChatCompletionResponse>('/public/chat/completions', {
            method: 'POST',
            body: JSON.stringify(request),
          });
        },
      },
    },
    credits: {
      /**
       * Get credit balance
       */
      balance: async (): Promise<CreditBalance> => {
        return fetchAPI<CreditBalance>('/public/credits/balance');
      },
    },
  };
}
