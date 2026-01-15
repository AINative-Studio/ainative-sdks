import { writable, derived, get } from 'svelte/store';
import { ainativeConfig } from './config';
import type { CreditBalance, CreditsState, AINativeError } from '../types';

export interface CreditsOptions {
  autoFetch?: boolean;
}

function createCreditsStore(options: CreditsOptions = {}) {
  const initialState: CreditsState = {
    balance: null,
    isLoading: false,
    error: null,
  };

  const { subscribe, set, update } = writable<CreditsState>(initialState);

  const fetchBalance = async () => {
    const config = get(ainativeConfig);
    const baseUrl = config.baseUrl || 'https://api.ainative.studio';

    update(state => ({ ...state, isLoading: true, error: null }));

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
        update(state => ({ ...state, isLoading: false, error: errorObj }));
        throw new Error(errorObj.message);
      }

      const data: CreditBalance = await response.json();
      update(state => ({ ...state, balance: data, isLoading: false }));
    } catch (err) {
      const errorObj: AINativeError = {
        message: err instanceof Error ? err.message : 'Failed to fetch credit balance',
        code: 'CREDITS_ERROR',
      };
      update(state => ({ ...state, isLoading: false, error: errorObj }));
      throw err;
    }
  };

  if (options.autoFetch) {
    fetchBalance();
  }

  return {
    subscribe,
    refetch: fetchBalance,
  };
}

export function createCredits(options: CreditsOptions = {}) {
  const store = createCreditsStore(options);

  return {
    subscribe: store.subscribe,
    balance: derived(store, $store => $store.balance),
    isLoading: derived(store, $store => $store.isLoading),
    error: derived(store, $store => $store.error),
    refetch: store.refetch,
  };
}
