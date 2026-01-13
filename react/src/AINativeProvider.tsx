/**
 * AINative React Provider
 *
 * Provides API client configuration to child components via React Context.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { AINativeConfig } from './types';

interface AINativeContextValue {
  config: AINativeConfig;
  baseUrl: string;
}

const AINativeContext = createContext<AINativeContextValue | null>(null);

interface AINativeProviderProps {
  config: AINativeConfig;
  children: ReactNode;
}

/**
 * AINative Provider Component
 *
 * Wrap your app with this provider to enable AINative hooks.
 *
 * @example
 * ```tsx
 * import { AINativeProvider } from '@ainative/react-sdk';
 *
 * function App() {
 *   return (
 *     <AINativeProvider config={{ apiKey: 'your-jwt-token' }}>
 *       <YourApp />
 *     </AINativeProvider>
 *   );
 * }
 * ```
 */
export function AINativeProvider({ config, children }: AINativeProviderProps) {
  const baseUrl = config.baseUrl || 'https://api.ainative.studio/api/v1';

  const contextValue: AINativeContextValue = {
    config,
    baseUrl,
  };

  return (
    <AINativeContext.Provider value={contextValue}>
      {children}
    </AINativeContext.Provider>
  );
}

/**
 * Hook to access AINative context
 *
 * @internal
 */
export function useAINativeContext(): AINativeContextValue {
  const context = useContext(AINativeContext);

  if (!context) {
    throw new Error('useAINativeContext must be used within AINativeProvider');
  }

  return context;
}
