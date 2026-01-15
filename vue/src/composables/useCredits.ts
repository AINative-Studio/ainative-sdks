import { ref, computed, onMounted, type Ref } from 'vue';
import { useAINative } from './useAINative';
import type { CreditBalance, CreditsState, AINativeError } from '../types';

export interface UseCreditsOptions {
  autoFetch?: boolean;
}

export interface UseCreditsReturn {
  balance: Ref<CreditBalance | null>;
  isLoading: Ref<boolean>;
  error: Ref<AINativeError | null>;
  refetch: () => Promise<void>;
}

export function useCredits(options: UseCreditsOptions = {}): UseCreditsReturn {
  const config = useAINative();
  const baseUrl = config.baseUrl || 'https://api.ainative.studio';
  const { autoFetch = true } = options;

  const state = ref<CreditsState>({
    balance: null,
    isLoading: false,
    error: null,
  });

  const balance = computed(() => state.value.balance);
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);

  const fetchBalance = async () => {
    state.value.isLoading = true;
    state.value.error = null;

    try {
      const response = await fetch(`${baseUrl}/v1/public/credits/balance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorObj: AINativeError = {
          message: errorData.message || 'Failed to fetch credit balance',
          code: errorData.code,
          status: response.status,
        };
        state.value.error = errorObj;
        state.value.isLoading = false;
        throw new Error(errorObj.message);
      }

      const data: CreditBalance = await response.json();
      state.value.balance = data;
      state.value.isLoading = false;
    } catch (err) {
      const errorObj: AINativeError = {
        message: err instanceof Error ? err.message : 'Failed to fetch credit balance',
        code: 'CREDITS_ERROR',
      };
      state.value.error = errorObj;
      state.value.isLoading = false;
      throw err;
    }
  };

  const refetch = async () => {
    await fetchBalance();
  };

  if (autoFetch) {
    onMounted(() => {
      fetchBalance();
    });
  }

  return {
    balance,
    isLoading,
    error,
    refetch,
  };
}
