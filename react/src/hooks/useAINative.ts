/**
 * useAINative Hook
 *
 * Provides access to the configured AINative API client.
 */

import { useAINativeContext } from '../AINativeProvider';
import { AINativeConfig } from '../types';

export interface AINativeClient {
  config: AINativeConfig;
  baseUrl: string;
}

/**
 * Hook to access AINative API client configuration
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useAINative();
 *   console.log(client.baseUrl); // 'https://api.ainative.studio/api/v1'
 * }
 * ```
 */
export function useAINative(): AINativeClient {
  const context = useAINativeContext();

  return {
    config: context.config,
    baseUrl: context.baseUrl,
  };
}
