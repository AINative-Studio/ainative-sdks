/**
 * Tests for useAINative hook
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useAINative } from '../hooks/useAINative';

describe('useAINative', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  it('should return client configuration', () => {
    const { result } = renderHook(() => useAINative(), { wrapper });

    expect(result.current.config.apiKey).toBe('test-api-key');
    expect(result.current.baseUrl).toBe('https://api.ainative.studio/api/v1');
  });

  it('should provide consistent client instance', () => {
    const { result, rerender } = renderHook(() => useAINative(), { wrapper });

    const firstClient = result.current;
    rerender();
    const secondClient = result.current;

    expect(firstClient.config).toEqual(secondClient.config);
    expect(firstClient.baseUrl).toBe(secondClient.baseUrl);
  });
});
