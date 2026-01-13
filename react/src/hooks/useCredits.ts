/**
 * useCredits Hook
 *
 * Provides access to user's credit balance and usage information.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAINativeContext } from '../AINativeProvider';
import { CreditBalance, AINativeError, UseCreditsReturn } from '../types';

/**
 * Hook for managing credit balance
 *
 * @example
 * ```tsx
 * function CreditsDisplay() {
 *   const { balance, isLoading, error, refetch } = useCredits();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Credits: {balance?.remaining_credits}</h2>
 *       <p>Plan: {balance?.plan}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCredits(): UseCreditsReturn {
  const { config, baseUrl } = useAINativeContext();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AINativeError | null>(null);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/public/credits/balance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CreditBalance = await response.json();
      setBalance(data);
      setIsLoading(false);
    } catch (err) {
      const errorObj: AINativeError = {
        message: err instanceof Error ? err.message : 'Failed to fetch credit balance',
      };
      setError(errorObj);
      setIsLoading(false);
    }
  }, [config.apiKey, baseUrl]);

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
