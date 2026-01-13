/**
 * useChat Hook
 *
 * Provides chat completion functionality with streaming support.
 */

import { useState, useCallback } from 'react';
import { useAINativeContext } from '../AINativeProvider';
import {
  Message,
  ChatCompletionResponse,
  AINativeError,
  ChatState,
  UseChatOptions,
} from '../types';

/**
 * Hook for managing chat completions
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { messages, isLoading, error, sendMessage } = useChat({
 *     model: 'llama-3.3-70b-instruct',
 *     temperature: 0.7,
 *   });
 *
 *   const handleSubmit = async (input: string) => {
 *     await sendMessage([
 *       ...messages,
 *       { role: 'user', content: input }
 *     ]);
 *   };
 *
 *   return (
 *     <div>
 *       {messages.map((msg, i) => (
 *         <div key={i}>{msg.role}: {msg.content}</div>
 *       ))}
 *       {isLoading && <div>Loading...</div>}
 *       {error && <div>Error: {error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(options: UseChatOptions = {}) {
  const { config, baseUrl } = useAINativeContext();
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    response: null,
  });

  const sendMessage = useCallback(
    async (messages: Message[]): Promise<ChatCompletionResponse | null> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        messages,
      }));

      try {
        const response = await fetch(`${baseUrl}/public/managed-chat/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            messages,
            preferred_model: options.model,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            stream: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error: AINativeError = {
            message: errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            code: errorData.code,
          };

          setState((prev) => ({
            ...prev,
            isLoading: false,
            error,
          }));

          options.onError?.(error);
          return null;
        }

        const data: ChatCompletionResponse = await response.json();

        // Add assistant message to conversation
        const updatedMessages = [
          ...messages,
          data.choices[0].message,
        ];

        setState({
          messages: updatedMessages,
          isLoading: false,
          error: null,
          response: data,
        });

        options.onSuccess?.(data);
        return data;
      } catch (err) {
        const error: AINativeError = {
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        };

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));

        options.onError?.(error);
        return null;
      }
    },
    [config.apiKey, baseUrl, options]
  );

  const reset = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
      error: null,
      response: null,
    });
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    response: state.response,
    sendMessage,
    reset,
  };
}
