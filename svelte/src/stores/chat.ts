import { writable, derived, get } from 'svelte/store';
import { ainativeConfig } from './config';
import type { Message, ChatCompletionResponse, ChatState, AINativeError } from '../types';

export interface ChatOptions {
  initialMessages?: Message[];
  model?: string;
}

function createChatStore(options: ChatOptions = {}) {
  const initialState: ChatState = {
    messages: options.initialMessages || [],
    isLoading: false,
    error: null,
  };

  const { subscribe, set, update } = writable<ChatState>(initialState);

  return {
    subscribe,
    sendMessage: async (messagesToSend: Message[]): Promise<ChatCompletionResponse | null> => {
      const config = get(ainativeConfig);
      const baseUrl = config.baseUrl || 'https://api.ainative.studio';

      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const response = await fetch(`${baseUrl}/v1/public/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.apiKey,
          },
          body: JSON.stringify({
            model: options.model || 'claude-3-5-sonnet-20241022',
            messages: messagesToSend,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          const errorObj: AINativeError = {
            message: errorData.message || 'Failed to send message',
            code: errorData.code,
            status: response.status,
          };
          update(state => ({ ...state, isLoading: false, error: errorObj }));
          throw new Error(errorObj.message);
        }

        const data: ChatCompletionResponse = await response.json();
        const assistantMessage = data.choices[0]?.message;

        if (assistantMessage) {
          const updatedMessages = [...messagesToSend, assistantMessage];
          update(state => ({ ...state, messages: updatedMessages, isLoading: false }));
        } else {
          update(state => ({ ...state, isLoading: false }));
        }

        return data;
      } catch (err) {
        const errorObj: AINativeError = {
          message: err instanceof Error ? err.message : 'Failed to send message',
          code: 'CHAT_ERROR',
        };
        update(state => ({ ...state, isLoading: false, error: errorObj }));
        throw err;
      }
    },
    reset: () => {
      set({
        messages: options.initialMessages || [],
        isLoading: false,
        error: null,
      });
    },
  };
}

export function createChat(options: ChatOptions = {}) {
  const store = createChatStore(options);

  return {
    subscribe: store.subscribe,
    messages: derived(store, $store => $store.messages),
    isLoading: derived(store, $store => $store.isLoading),
    error: derived(store, $store => $store.error),
    sendMessage: store.sendMessage,
    reset: store.reset,
  };
}
