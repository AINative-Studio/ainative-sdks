/**
 * Tests for useCredits hook
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useCredits } from '../hooks/useCredits';

// Mock fetch
global.fetch = jest.fn();

describe('useCredits', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch credit balance on mount', async () => {
    const mockBalance = {
      total_credits: 1000,
      used_credits: 250,
      remaining_credits: 750,
      plan: 'basic',
      period_start: '2024-01-01T00:00:00Z',
      period_end: '2024-02-01T00:00:00Z',
      usage_percentage: 25,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBalance,
    });

    const { result } = renderHook(() => useCredits(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.balance).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.balance).toEqual(mockBalance);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        detail: 'Invalid API key',
      }),
    });

    const { result } = renderHook(() => useCredits(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.balance).toBeNull();
    expect(result.current.error).toEqual({
      message: 'Invalid API key',
    });
  });

  it('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useCredits(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.balance).toBeNull();
    expect(result.current.error).toEqual({
      message: 'Network error',
    });
  });

  it('should refetch balance when refetch is called', async () => {
    const mockBalance1 = {
      total_credits: 1000,
      used_credits: 250,
      remaining_credits: 750,
      plan: 'basic',
      period_start: '2024-01-01T00:00:00Z',
      period_end: '2024-02-01T00:00:00Z',
      usage_percentage: 25,
    };

    const mockBalance2 = {
      ...mockBalance1,
      used_credits: 300,
      remaining_credits: 700,
      usage_percentage: 30,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBalance1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBalance2,
      });

    const { result } = renderHook(() => useCredits(), { wrapper });

    await waitFor(() => {
      expect(result.current.balance).toEqual(mockBalance1);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.balance).toEqual(mockBalance2);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should use correct API endpoint', async () => {
    const mockBalance = {
      total_credits: 1000,
      used_credits: 250,
      remaining_credits: 750,
      plan: 'basic',
      period_start: '2024-01-01T00:00:00Z',
      period_end: '2024-02-01T00:00:00Z',
      usage_percentage: 25,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBalance,
    });

    renderHook(() => useCredits(), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.ainative.studio/api/v1/public/credits/balance',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        })
      );
    });
  });
});
