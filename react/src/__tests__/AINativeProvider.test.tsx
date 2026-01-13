/**
 * Tests for AINativeProvider
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { AINativeProvider, useAINativeContext } from '../AINativeProvider';

describe('AINativeProvider', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
  };

  it('should provide context to children', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
    );

    const { result } = renderHook(() => useAINativeContext(), { wrapper });

    expect(result.current.config.apiKey).toBe('test-api-key');
    expect(result.current.baseUrl).toBe('https://api.ainative.studio/api/v1');
  });

  it('should allow custom baseUrl', () => {
    const customConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://custom.api.com/v2',
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AINativeProvider config={customConfig}>{children}</AINativeProvider>
    );

    const { result } = renderHook(() => useAINativeContext(), { wrapper });

    expect(result.current.baseUrl).toBe('https://custom.api.com/v2');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      renderHook(() => useAINativeContext());
    }).toThrow('useAINativeContext must be used within AINativeProvider');

    consoleErrorSpy.mockRestore();
  });
});
