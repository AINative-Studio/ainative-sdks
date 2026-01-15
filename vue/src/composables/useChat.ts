import { ref, computed, type Ref } from 'vue';
import { useAINative } from './useAINative';
import type { Message, ChatCompletionResponse, ChatState, AINativeError } from '../types';

export interface UseChatOptions {
  initialMessages?: Message[];
  model?: string;
}

export interface UseChatReturn {
  messages: Ref<Message[]>;
  isLoading: Ref<boolean>;
  error: Ref<AINativeError | null>;
  sendMessage: (messages: Message[]) => Promise<ChatCompletionResponse | null>;
  reset: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const config = useAINative();
  const baseUrl = config.baseUrl || 'https://api.ainative.studio';

  const state = ref<ChatState>({
    messages: options.initialMessages || [],
    isLoading: false,
    error: null,
  });

  const messages = computed(() => state.value.messages);
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);

  const sendMessage = async (
    messagesToSend: Message[]
  ): Promise<ChatCompletionResponse | null> => {
    state.value.isLoading = true;
    state.value.error = null;

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
        state.value.error = errorObj;
        state.value.isLoading = false;
        throw new Error(errorObj.message);
      }

      const data: ChatCompletionResponse = await response.json();
      const assistantMessage = data.choices[0]?.message;

      if (assistantMessage) {
        const updatedMessages = [...messagesToSend, assistantMessage];
        state.value.messages = updatedMessages;
      }

      state.value.isLoading = false;
      return data;
    } catch (err) {
      const errorObj: AINativeError = {
        message: err instanceof Error ? err.message : 'Failed to send message',
        code: 'CHAT_ERROR',
      };
      state.value.error = errorObj;
      state.value.isLoading = false;
      throw err;
    }
  };

  const reset = () => {
    state.value = {
      messages: options.initialMessages || [],
      isLoading: false,
      error: null,
    };
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    reset,
  };
}
